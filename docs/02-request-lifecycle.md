# Request Lifecycle

This document traces a single HTTP request — `POST /orders` — from the moment a client sends it until it appears as a data point on the React Dashboard.

The critical insight is that this lifecycle splits into two independent paths after the microservice processes the request:
1. **The response path** — synchronous, returns immediately to the client
2. **The telemetry path** — asynchronous, continues through Kafka → Spark → Elasticsearch → Dashboard

---

## Timeline Overview

```
T+0ms    Client sends POST /orders
T+1ms    Nginx receives request, routes to Order Service
T+5ms    Order Service validates and processes request
T+6ms    HTTP 200 response sent back to client  ← CLIENT IS DONE HERE
T+7ms    Structured telemetry event published to Kafka (async)
T+500ms  Spark micro-batch consumes event from Kafka
T+900ms  Spark computes window aggregations, writes to Elasticsearch
T+5000ms React Dashboard polls Analytics API
T+5010ms Dashboard charts update with new data point
```

The client completes at ~6ms. The telemetry takes ~5 seconds to appear on the dashboard. This is the fundamental trade-off of streaming analytics — eventual consistency in exchange for architectural decoupling.

---

## Stage 1 — Client Request

A client (browser, load generator, or `curl`) fires:

```http
POST /orders HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{"order_id": "ord-123", "user_id": "usr-456", "amount": 1200}
```

The request reaches Nginx on port `8000`. At this point no telemetry has been generated.

---

## Stage 2 — Nginx Routing

Nginx inspects the URL path. The `nginx.conf` contains upstream blocks:

```nginx
location /orders {
    proxy_pass http://order-service:8001;
}
location /users {
    proxy_pass http://user-service:8002;
}
location /payment {
    proxy_pass http://payment-service:8003;
}
```

Nginx forwards the request to `order-service:8001` inside the Docker network. The client does not know that `order-service` exists — it only ever sees `localhost:8000`.

---

## Stage 3 — Microservice Processing

The Order Service receives the request. Inside the FastAPI handler:

1. **Validate** — Pydantic model validates the request body
2. **Business Logic** — Process the order (mock logic in this project)
3. **Prepare Response** — Build the HTTP response object
4. **Generate Telemetry** — Construct a structured JSON event describing what happened

```python
telemetry_event = {
    "timestamp": datetime.utcnow().isoformat(),
    "service": "order-service",
    "endpoint": "/orders",
    "method": "POST",
    "status_code": 200,
    "response_time_ms": 4.7,
    "request_id": request_id,
    "user_id": body.user_id,
    "level": "INFO",
    "message": "Order created successfully"
}
```

---

## Stage 4 — Async Kafka Publish

The telemetry event is published to Kafka using an **async producer** — this is critical. The `await producer.send()` is a fire-and-forget call; the HTTP response is not blocked waiting for Kafka acknowledgement.

```python
# Non-blocking — does not delay the HTTP response
asyncio.create_task(kafka_producer.send("telemetry-logs", telemetry_event))

# This returns immediately
return JSONResponse({"status": "created", "order_id": order_id})
```

The HTTP response reaches the client. The telemetry event is now queued in Kafka.

---

## Stage 5 — Kafka Retention

The event is appended to the `telemetry-logs` Kafka topic as an ordered, durable record. Kafka stores it on disk with configurable retention (default: 7 days).

The key property here: **Kafka stores the event regardless of whether Spark is running**. If Spark crashes and restarts, it reads the committed consumer group offset and resumes exactly where it left off — no events are lost.

---

## Stage 6 — Spark Micro-Batch Processing

Spark Structured Streaming polls Kafka continuously. Every second (configurable), it reads a batch of new events from the topic.

**Processing steps within the micro-batch:**

1. **Deserialize** — Parse JSON string to Spark schema
2. **Filter** — Drop malformed records missing required fields
3. **Timestamp normalization** — Parse ISO 8601 strings to Spark timestamps
4. **Window aggregation** — Apply a tumbling window (e.g., 1-minute windows) and compute:
   - `count` (RPS)
   - `avg(response_time_ms)` (average latency)
   - `percentile_approx(response_time_ms, 0.95)` (P95)
   - `sum(status_code >= 400) / count` (error rate)
5. **Group by** — Results grouped by `service` and `window.start`
6. **Write** — Bulk index to Elasticsearch in two writes:
   - Raw log document → `logs-*` index
   - Aggregated metric document → `metrics-*` index

---

## Stage 7 — Elasticsearch Indexing

Two documents are written to Elasticsearch for every micro-batch.

**Raw log (searchable by trace_id or keyword):**
```json
{
  "@timestamp": "2024-01-15T12:00:05.123Z",
  "service": "order-service",
  "endpoint": "/orders",
  "status_code": 200,
  "response_time_ms": 4.7,
  "level": "INFO",
  "message": "Order created successfully"
}
```

**Aggregated metric (used by dashboard charts):**
```json
{
  "@timestamp": "2024-01-15T12:00:00.000Z",
  "service": "order-service",
  "window": "1m",
  "rps": 127,
  "avg_latency_ms": 6.2,
  "p95_latency_ms": 18.4,
  "error_rate": 0.008
}
```

---

## Stage 8 — Analytics API Query

The React Dashboard polls `GET /api/metrics/overview` every 5 seconds. The Analytics API executes an Elasticsearch aggregation query:

```
GET metrics-*/_search
{
  "query": { "range": { "@timestamp": { "gte": "now-15m" } } },
  "aggs": { "by_service": { "terms": { "field": "service" } } }
}
```

Results are cached in Redis for the polling interval. Subsequent dashboard polls within that window are served from Redis without hitting Elasticsearch again.

---

## Stage 9 — Dashboard Render

The React hook `useMetrics()` receives the JSON response from the Analytics API and updates state. Recharts re-renders the time-series chart by appending the new data point to the existing series array. The chart animates smoothly — no full page reload.

The user sees the `POST /orders` request reflected as a data point on the dashboard approximately 5 seconds after the original request.

---

## Why Not Write Directly to Elasticsearch?

This is the most common question about the architecture.

**Direct write approach:**
```
FastAPI → Elasticsearch (synchronous, blocking)
```

Problems:
- Elasticsearch write latency (5–20ms) adds to every API response
- If Elasticsearch is down, the API request fails
- No replay capability — lost writes are gone
- Tight coupling between services and the analytics store

**Kafka-buffered approach:**
```
FastAPI → Kafka (async, <1ms) → Spark → Elasticsearch
```

Benefits:
- Zero impact on API latency
- Elasticsearch outages don't affect business services
- Kafka retains events until Spark processes them
- Multiple consumers can process the same events independently
