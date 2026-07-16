# API Reference

The Analytics API is a FastAPI backend that serves all dashboard data. It abstracts Elasticsearch and Redis behind a consistent REST interface, allowing the frontend to remain independent of the storage layer.

All business microservices and the Analytics API expose interactive Swagger documentation at `/docs`.

Base URL (local): `http://localhost:8004`  
Base URL (via gateway): `http://localhost:8000/api`

All responses are JSON. All endpoints support a `time_range` query parameter (default: `15m`). Valid values: `5m`, `15m`, `1h`, `6h`, `24h`.

---

## Service Swagger UIs

### User Service

![User Service API](images/swagger_user.png)

Available at: `http://localhost:8002/docs`

---

### Order Service

![Order Service API](images/swagger_order.png)

Available at: `http://localhost:8001/docs`

---

### Payment Service

![Payment Service API](images/swagger_payment.png)

Available at: `http://localhost:8003/docs`

---

### Analytics API

![Analytics API](images/swagger_analytics.png)

Available at: `http://localhost:8004/docs`

---

## GET /system/overview

Returns platform-wide health aggregates and per-service status.

**Request**
```http
GET /api/system/overview?time_range=15m
```

**Response 200**
```json
{
  "timestamp": "2024-01-15T12:00:00Z",
  "time_range": "15m",
  "overall_status": "healthy",
  "throughput": 127.4,
  "avg_latency_ms": 8.2,
  "error_rate": 0.012,
  "total_requests": 114660,
  "services": [
    {
      "name": "order-service",
      "status": "healthy",
      "rps": 38.6,
      "latency": { "avg": 9.1, "p50": 7.3, "p95": 22.8, "p99": 41.0 },
      "error_rate": 0.018
    }
  ]
}
```

---

## GET /metrics/timeseries

Returns time-series data points for charting.

**Request**
```http
GET /api/metrics/timeseries?metric=latency&service=order-service&interval=1m&time_range=1h
```

**Parameters**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `metric` | string | Yes | `latency`, `rps`, `errors`, `throughput` |
| `service` | string | No | Filter to specific service |
| `interval` | string | No | Bucket size: `30s`, `1m`, `5m` |
| `time_range` | string | No | Window: `15m`, `1h`, `6h`, `24h` |

**Response 200**
```json
{
  "metric": "latency",
  "service": "order-service",
  "data": [
    { "timestamp": "2024-01-15T11:00:00Z", "p50": 6.8, "p95": 19.7, "p99": 38.4, "avg": 8.1 }
  ]
}
```

---

## GET /logs/search

Full-text search and filter over raw telemetry logs.

**Request**
```http
GET /api/logs/search?query=timeout&service=payment-service&level=ERROR&limit=50
```

**Parameters**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | No | Full-text search (Elasticsearch query string) |
| `service` | string | No | Filter by service name |
| `level` | string | No | `INFO`, `WARN`, `ERROR` |
| `limit` | int | No | Max 500, default 50 |
| `time_range` | string | No | See above |

**Response 200**
```json
{
  "total": 14,
  "logs": [
    {
      "timestamp": "2024-01-15T11:58:22Z",
      "service": "payment-service",
      "endpoint": "/payment/process",
      "status_code": 504,
      "response_time_ms": 5002.1,
      "level": "ERROR",
      "request_id": "req-789xyz",
      "message": "Payment gateway timeout after 5000ms"
    }
  ]
}
```

---

## GET /services/{service_name}

Returns detailed metrics for a single service.

**Request**
```http
GET /api/services/payment-service?time_range=1h
```

**Response 200**
```json
{
  "name": "payment-service",
  "status": "degraded",
  "summary": { "total_requests": 9612, "error_rate": 0.035 },
  "latency": { "avg": 12.4, "p50": 9.6, "p95": 38.1, "p99": 92.5 },
  "top_endpoints": [
    { "endpoint": "/payment/process", "requests": 6041, "avg_latency_ms": 14.2, "error_rate": 0.042 }
  ]
}
```

---

## GET /cluster/status

Returns health of infrastructure components.

**Response 200**
```json
{
  "elasticsearch": { "status": "green", "indices": 12, "documents": 4812900 },
  "kafka": { "status": "healthy", "topics": 3, "messages_per_sec": 127 },
  "redis": { "status": "healthy", "hit_rate": 0.84, "memory_used_mb": 42 }
}
```

---

## Standard Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Invalid parameter value |
| `503` | Elasticsearch or Redis unreachable |
