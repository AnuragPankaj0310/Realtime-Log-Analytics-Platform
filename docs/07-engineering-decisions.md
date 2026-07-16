# Engineering Decisions

Every major architectural choice in this project was made deliberately. This document explains the reasoning behind each decision and what was explicitly rejected.

---

## Why Kafka?

**Rejected alternatives:** Direct Elasticsearch writes, RabbitMQ, Redis Pub/Sub

The core problem with writing telemetry directly to Elasticsearch from each microservice is tight coupling. If Elasticsearch is unavailable, down for maintenance, or simply slow under index pressure, every API request would either fail or take longer.

Kafka introduces a durable, ordered buffer between the services and the analytics pipeline. The services publish events in under 1ms and immediately return responses. Kafka retains those events until Spark processes them — even across Spark restarts.

The additional benefit is replay. If the Elasticsearch schema changes and a re-index is required, Spark can be configured to re-read from offset 0, replaying all historical events.

**Why not RabbitMQ?** RabbitMQ is designed for task queues — messages are consumed and deleted. Kafka is a distributed log, which is exactly what a telemetry pipeline needs: ordered, replayable, retained events.

**Why not Redis Pub/Sub?** No persistence. A Redis restart loses all in-flight messages.

---

## Why Spark Structured Streaming?

**Rejected alternatives:** Apache Flink, Kafka Streams, custom Python consumer

Spark was chosen because:
1. **Python API (PySpark)** — the rest of the project is Python; consistency matters
2. **`percentile_approx()`** — built-in approximate percentile calculation over windows, which would require significant custom code in a plain Kafka Streams consumer
3. **Micro-batch model** — acceptable for 5-second dashboard polling; true event-time streaming is unnecessary
4. **Ecosystem maturity** — extensive documentation and community support

**Why not Flink?** Flink offers lower latency and richer event-time semantics (watermarks, late data handling), but its Java-centric API adds friction. Since the dashboard polls every 5 seconds, Flink's sub-second latency advantage is irrelevant for this use case.

**Why not a plain Python consumer?** Computing running percentiles correctly in a stateful Python loop is complex and not production-quality. Spark's windowing functions solve this cleanly.

---

## Why Elasticsearch?

**Rejected alternatives:** PostgreSQL, MongoDB, ClickHouse

Observability requires two things: **full-text search** (find this trace ID in millions of logs) and **fast aggregations** (compute P95 latency grouped by service for the last 15 minutes).

Elasticsearch's inverted index is specifically designed for full-text search. Its aggregation framework (bucket + metric aggregations) handles the time-series queries the dashboard requires. The `@timestamp` field enables range queries that are highly optimized via date histograms.

**Why not PostgreSQL?** Full-text search via `LIKE '%term%'` or even `tsvector` is orders of magnitude slower than Elasticsearch at the scale of millions of log records. Aggregation queries would require careful indexing and optimization.

**Why not ClickHouse?** ClickHouse is excellent for columnar analytics but lacks mature full-text search support. It would work well for metrics but not for the log search use case.

---

## Why HTTP Polling over WebSockets?

**The question:** Dashboard metrics update every 5 seconds. Why not use WebSockets for true push-based updates?

**The answer:** Aggregated metrics don't change frequently enough to justify WebSocket complexity.

With polling:
- The Analytics API is stateless — any number of replicas can serve requests
- Redis caches responses between polls — Elasticsearch is hit only once per 5-second window
- Load balancers work correctly — no sticky sessions required
- No connection management — clients simply retry if the server restarts

With WebSockets:
- Server must maintain connection state for every connected client
- Load balancing requires sticky sessions or a shared pub/sub backend
- Reconnection logic is required on the client
- Server push requires a pub/sub mechanism (Redis Pub/Sub, etc.) adding another dependency

**Exception:** The Logs page uses SSE (Server-Sent Events) for the live stream because polling every 5 seconds would produce a visibly jerky update experience. SSE gives the appearance of streaming while remaining simpler than full WebSockets.

---

## Why FastAPI?

**Rejected alternatives:** Flask, Django, Node.js/Express

FastAPI was selected specifically because:
1. **`asyncio` support** — the Kafka producer must be `async` to avoid blocking request threads. Flask does not support async natively.
2. **Type safety via Pydantic** — request validation and response schemas are defined as Python type annotations, reducing boilerplate
3. **Automatic OpenAPI docs** — `/docs` is available without any additional setup
4. **Performance** — FastAPI benchmarks significantly faster than Flask for async-heavy workloads

---

## Why Microservices?

**The legitimate question:** This project simulates three services with similar code. Why not a monolith?

The answer is that the observability pipeline only becomes interesting in a distributed system. With a single service, there is nothing to correlate across boundaries, no fan-out to aggregate, no cross-service latency to measure.

The three-service setup creates the conditions needed to demonstrate:
- Different services having different latency profiles
- Errors in one service not affecting others
- Traffic distribution across services (visible in Analytics)
- Per-service health monitoring on the Services page

---

## Why Docker Compose over Kubernetes?

**The goal was reproducibility, not production-readiness.**

Running `docker compose up -d` deploys all 11 containers on any machine with Docker Desktop. No cluster, no cloud account, no configuration management required.

Kubernetes would provide:
- Self-healing (restart failed containers)
- Rolling deployments
- Horizontal Pod Autoscaling
- Multi-node distribution

These are valuable in production, but they add significant setup complexity that would make the project harder to evaluate. The architecture is designed to be Kubernetes-compatible — each service is stateless and containerized — but orchestration choice is an operational concern, not an architectural one.
