# Project Structure

## Top-Level Layout

```
realtime-log-analytics-platform/
├── dashboard/              # React + TypeScript SPA
├── services/               # FastAPI microservices
├── streaming/              # Spark PySpark jobs
├── infrastructure/         # Nginx, Docker configs
├── scripts/                # Developer utilities
├── load_tests/             # Raw k6 scenarios
├── docs/                   # Technical documentation
├── config/                 # Shared env configs
├── .env.example            # Environment variable template
└── docker-compose.yml      # Full-stack orchestration
```

---

## `dashboard/`

The React single-page application.

```
dashboard/
├── src/
│   ├── pages/
│   │   ├── Overview.tsx        # Entry point dashboard page
│   │   ├── Metrics.tsx         # Time-series performance page
│   │   ├── Analytics.tsx       # Historical analysis page
│   │   ├── Logs.tsx            # Live log stream page
│   │   ├── Services.tsx        # Per-service drill-down page
│   │   └── Architecture.tsx    # System topology diagram
│   ├── hooks/
│   │   ├── useMetrics.ts       # Polls /api/metrics/timeseries
│   │   ├── useLogs.ts          # Polls /api/logs/search
│   │   └── useSystemStatus.ts  # Polls /api/system/overview
│   ├── components/             # Shared UI components (cards, charts, tables)
│   └── App.tsx                 # Router and layout
├── Dockerfile                  # Multi-stage: build React → serve via nginx
└── package.json
```

**Key architectural decision:** Data-fetching logic is fully isolated in `hooks/`. Components only receive data and render — they contain no API calls. This makes pages testable and keeps the rendering logic clean.

---

## `services/`

Three independent FastAPI microservices plus the Analytics API.

```
services/
├── user-service/
│   ├── main.py             # FastAPI app, route handlers
│   ├── kafka_producer.py   # Async Kafka producer wrapper
│   ├── models.py           # Pydantic request/response models
│   └── Dockerfile
├── order-service/
│   ├── main.py
│   ├── kafka_producer.py
│   ├── models.py
│   └── Dockerfile
├── payment-service/
│   ├── main.py
│   ├── kafka_producer.py
│   ├── models.py
│   └── Dockerfile
└── analytics-api/
    ├── main.py             # FastAPI app, all /api/* routes
    ├── elasticsearch_client.py  # Query builder for ES
    ├── redis_client.py     # Cache read/write wrapper
    ├── models.py           # Response schema definitions
    └── Dockerfile
```

**Important pattern in each microservice's `main.py`:** After processing a request, telemetry is published via `asyncio.create_task()` so it never blocks the response.

---

## `streaming/`

Spark Structured Streaming jobs.

```
streaming/
├── aggregator.py           # Main streaming job
├── schemas.py              # PySpark schema definitions for Kafka JSON
├── elasticsearch_sink.py   # Elasticsearch write configuration
└── Dockerfile              # Extends bitnami/spark image
```

**`aggregator.py` is the most important file in this directory.** It defines:
- Kafka source configuration (brokers, topic, starting offset)
- JSON parsing schema
- Tumbling window definitions (1-minute windows)
- Aggregation expressions (percentile_approx, count, avg)
- Elasticsearch write stream with `foreachBatch` sink

---

## `infrastructure/`

```
infrastructure/
├── nginx/
│   └── nginx.conf          # Upstream blocks, routing rules, static serving
└── grafana/
    └── dashboards/         # Provisioned Grafana dashboard JSON files
```

The `nginx.conf` is critical — it defines the routing table that maps URL paths to internal Docker service names.

---

## `scripts/`

```
scripts/
└── generate_load.py        # CLI load generator (wraps k6 via Docker)
```

See [08-performance-testing.md](08-performance-testing.md) for usage.

---

## `load_tests/`

Raw k6 JavaScript files used internally by `generate_load.py`.

```
load_tests/
├── script.js               # Ramping-VUs scenario (ramp up to 1000 users)
└── continuous.js           # Constant-VUs scenario (baseline load)
```

These can also be run directly:
```bash
docker run --rm -i grafana/k6 run - < load_tests/continuous.js
```

---

## `docker-compose.yml`

Defines all 11 containers:

| Service | Image | Ports |
|---------|-------|-------|
| `nginx` | nginx:alpine | 8000 |
| `user-service` | local build | 8001 (internal) |
| `order-service` | local build | 8002 (internal) |
| `payment-service` | local build | 8003 (internal) |
| `analytics-api` | local build | 8004 (internal) |
| `dashboard` | local build | 3000 |
| `kafka` | confluentinc/cp-kafka | 9092 (internal) |
| `zookeeper` | confluentinc/cp-zookeeper | 2181 (internal) |
| `spark` | bitnami/spark | — (internal) |
| `elasticsearch` | elasticsearch:8.15.0 | 9200 (internal) |
| `redis` | redis:7-alpine | 6379 (internal) |
| `kibana` | kibana:8.15.0 | 5601 |
| `grafana` | grafana/grafana | 3001 |
| `kafka-ui` | provectuslabs/kafka-ui | 8081 |

Only `nginx` (8000), `dashboard` (3000), `kibana` (5601), `grafana` (3001), and `kafka-ui` (8081) expose ports to the host. All other communication is internal.

---

## `.env.example`

Contains all configurable environment variables:

```env
KAFKA_BROKER_URL=kafka:9092
ELASTICSEARCH_URL=http://elasticsearch:9200
REDIS_HOST=redis
REDIS_PORT=6379
ANALYTICS_API_URL=http://analytics-api:8004
```

Copy to `.env` before starting. The Docker Compose file reads these at runtime.
