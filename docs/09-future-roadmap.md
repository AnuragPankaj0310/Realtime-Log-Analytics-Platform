# Future Roadmap

Improvements are grouped by theme and approximate priority. Phase 1 items address the most significant production gaps. Later phases explore scalability and cloud-native deployment.

---

## Phase 1 — Infrastructure

**Kafka KRaft Mode**
Replace the Kafka + Zookeeper pair with Kafka in KRaft mode. Eliminates the Zookeeper container entirely, reduces the container count, and simplifies the dependency graph.

**Elasticsearch Index Lifecycle Management (ILM)**
Currently, Elasticsearch indices grow indefinitely. ILM would automatically roll over indices (e.g., daily) and delete data older than 30 days. Without this, disk usage becomes a problem in any long-running deployment.

**Kafka Topic Partitioning**
Each Kafka topic currently uses a single partition. Adding partitions (e.g., one per service) enables Spark to consume from multiple partitions in parallel, linearly scaling Kafka throughput.

---

## Phase 2 — Security

**API Authentication (JWT)**
The Analytics API currently has no authentication. Any client that can reach port 8004 (or port 8000 via the gateway) can query all telemetry. Implementing JWT bearer tokens would secure the dashboard and API.

**Kafka ACLs**
Kafka currently allows any producer to publish to any topic. Implementing ACLs ensures that only the intended microservices can write to `telemetry-logs`, and only Spark can consume from it.

**TLS for Internal Services**
All internal service communication is currently HTTP. Adding TLS (even self-signed certificates within the Docker network) would reflect production security practices.

---

## Phase 3 — Observability

**OpenTelemetry Integration**
The current `request_id` approach is a custom trace correlation mechanism. Replacing it with the OpenTelemetry SDK would standardize trace propagation across all services, enabling compatibility with commercial observability backends (Jaeger, Zipkin, Datadog APM).

**Alert Manager**
A background service that continuously evaluates Elasticsearch metrics against configurable thresholds (e.g., error rate > 5%, P99 latency > 1000ms) and fires webhook notifications to Slack, PagerDuty, or email.

**Dead Letter Queue**
Events that Spark fails to parse or index should be written to a separate Kafka topic (DLQ) rather than silently dropped. The DLQ can be monitored separately and replayed after fixing the underlying issue.

---

## Phase 4 — Scalability

**Kubernetes Deployment (Helm Charts)**
Migrate from Docker Compose to Kubernetes with Helm Charts. This enables:
- Horizontal Pod Autoscaling for FastAPI services based on CPU
- Self-healing (automatic pod restart on failure)
- Rolling deployments with zero downtime
- Resource limits and requests per container

**Multiple Spark Workers**
The current Spark deployment uses a single worker. Adding multiple workers enables parallel micro-batch processing, reducing the Kafka consumer lag under high load.

**Elasticsearch Clustering**
Add a second Elasticsearch node for high availability and read scaling. Requires updating the Elasticsearch configuration and Docker Compose service definition.

---

## Phase 5 — Cloud

**Amazon MSK (Managed Kafka)**
Replace the self-managed Kafka container with Amazon MSK. Eliminates Zookeeper, provides automatic broker failover, and integrates with IAM for authentication.

**Amazon OpenSearch**
Replace the self-managed Elasticsearch container with Amazon OpenSearch Service. Provides managed backups, encryption at rest, and fine-grained access control.

**Amazon ElastiCache (Redis)**
Replace the self-managed Redis container with ElastiCache. Provides automatic failover, replication, and monitoring via CloudWatch.

**GitHub Actions CI/CD**
Implement a CI/CD pipeline that:
1. Runs `pytest` on every pull request
2. Builds and pushes Docker images to Amazon ECR on merge to main
3. Triggers a rolling deployment update on EC2 or ECS
