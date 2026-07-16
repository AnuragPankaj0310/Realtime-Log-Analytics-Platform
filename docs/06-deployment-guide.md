# Deployment Guide

## Local Deployment (Docker Compose)

The entire 11-container platform deploys with a single command.

### Prerequisites

- Docker Desktop (4.x+) — must be running before any commands
- Python 3.11 — required only for the load generator script
- 8 GB RAM minimum allocated to Docker (16 GB recommended)
- Ports `3000`, `3001`, `5601`, `8000`, `8081` must be free

### Steps

```bash
# 1. Clone
git clone https://github.com/your-org/realtime-log-analytics-platform.git
cd realtime-log-analytics-platform

# 2. Configure environment
cp .env.example .env

# 3. Start all containers
docker compose up -d --build

# 4. Monitor startup
docker compose logs -f elasticsearch kafka spark

# 5. Verify all services are healthy
docker compose ps
```

---

## Docker Services

All 11 containers running on the shared `observability-net` bridge network.

![Docker Services](images/docker_services.png)

| Service | Image | Port |
|---------|-------|------|
| `nginx` | nginx:alpine | 8000 |
| `user-service` | local build | 8002 (internal) |
| `order-service` | local build | 8001 (internal) |
| `payment-service` | local build | 8003 (internal) |
| `analytics-api` | local build | 8004 (internal) |
| `dashboard` | local build | 3000 |
| `kafka` | confluentinc/cp-kafka | 9092 (internal) |
| `zookeeper` | confluentinc/cp-zookeeper | 2181 (internal) |
| `spark` | bitnami/spark | — |
| `elasticsearch` | elasticsearch:8.15.0 | 9200 (internal) |
| `redis` | redis:7-alpine | 6379 (internal) |
| `kibana` | kibana:8.15.0 | 5601 |
| `grafana` | grafana/grafana | 3001 |
| `kafka-ui` | provectuslabs/kafka-ui | 8081 |

---

## Kafka UI

Inspect topics, consumer group offsets, and real-time message throughput.

![Kafka UI](images/kafka_ui.png)

Available at: `http://localhost:8081`

Use this to verify that FastAPI services are publishing to the `telemetry-logs` topic and that the Spark consumer group is keeping up with the message rate.

---

## Kibana — Discover

Raw Elasticsearch index exploration. Used for ad-hoc searches, schema inspection, and debugging.

![Kibana Discover](images/kibana_discover.png)

Available at: `http://localhost:5601`

Use this to search raw log events, inspect field mappings, and verify that Spark is correctly indexing documents into the `logs-*` and `metrics-*` indices.

---

## Kibana Dashboard

Pre-built Kibana dashboards showing log volume, error trends, and service-level breakdowns.

![Kibana Dashboard](images/kibana_dashboard.png)

---

## Grafana — Infrastructure Metrics

Container-level monitoring — CPU, memory, and network I/O per service.

![Grafana Dashboard](images/grafana_dashboard.png)

Available at: `http://localhost:3001` (admin / admin)

Grafana complements the React dashboard by focusing on **infrastructure health** (container CPU, memory) rather than application-level metrics (latency, RPS). Use both together during load testing to understand the full picture.

---

## Docker Networking

All containers run on a shared bridge network: `observability-net`. Internal service discovery uses Docker DNS:

- Kafka: `kafka:9092`
- Elasticsearch: `elasticsearch:9200`
- Redis: `redis:6379`
- Analytics API: `analytics-api:8004`

Only Nginx (8000), Dashboard (3000), Kibana (5601), Grafana (3001), and Kafka UI (8081) expose ports to the host machine.

---

## Volumes & Data Persistence

| Volume | Used By | Contains |
|--------|---------|----------|
| `es_data` | Elasticsearch | All indexed logs and metrics |
| `kafka_data` | Kafka | Topic messages (7-day retention) |
| `zookeeper_data` | Zookeeper | Cluster metadata |
| `redis_data` | Redis | Cached responses |
| `grafana_data` | Grafana | Dashboard configs |

To reset all data:
```bash
docker compose down -v
docker compose up -d --build
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BROKER_URL` | `kafka:9092` | Kafka broker for producers |
| `ELASTICSEARCH_URL` | `http://elasticsearch:9200` | Elasticsearch endpoint |
| `REDIS_HOST` | `redis` | Redis hostname |
| `ANALYTICS_API_URL` | `http://analytics-api:8004` | Analytics backend |

---

## Health Checks

```bash
# Platform health
curl http://localhost:8000/health

# Elasticsearch cluster status
curl http://localhost:9200/_cluster/health

# Individual service
docker compose ps
```

---

## AWS EC2 Deployment

### Instance Sizing

| Instance | RAM | vCPU | Suitability |
|----------|-----|------|-------------|
| `t3.large` | 8 GB | 2 | May OOM under heavy load |
| `t3.xlarge` | 16 GB | 4 | Recommended |
| `t3.2xlarge` | 32 GB | 8 | Comfortable for sustained testing |

### Setup Steps

```bash
# 1. SSH into EC2
ssh -i your-key.pem ubuntu@<ec2-public-ip>

# 2. Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu
# Log out and back in

# 3. Clone and start
git clone https://github.com/your-org/realtime-log-analytics-platform.git
cd realtime-log-analytics-platform
cp .env.example .env
docker compose up -d --build
```

### Security Group Inbound Rules

| Port | Description |
|------|-------------|
| 22 | SSH |
| 3000 | React Dashboard |
| 3001 | Grafana |
| 5601 | Kibana |
| 8000 | API Gateway |
| 8081 | Kafka UI |
