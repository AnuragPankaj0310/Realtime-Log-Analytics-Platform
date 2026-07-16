# Lessons Learned

## Challenges Faced

### Memory Management Across JVM Services

The first major challenge was running Kafka, Spark, and Elasticsearch simultaneously on a developer workstation. Each allocates a JVM heap and expects to be the primary consumer of memory. On an 8 GB machine, the OS began swapping, causing random container kills mid-test.

The resolution was configuring explicit heap limits in `docker-compose.yml` via `ES_JAVA_OPTS` and `KAFKA_HEAP_OPTS`, and accepting that a minimum of 16 GB is required for a comfortable development experience.

**Lesson:** When building locally with JVM-based tools, always set explicit memory limits. Relying on default JVM ergonomics in a multi-container environment causes unpredictable behavior.

---

### Kafka Consumer Offset Management

Early versions of the Spark streaming job used `startingOffsets: "latest"`. This caused a significant bug: when the Spark container restarted (which happened often during development), it would skip all events that arrived during the downtime.

Switching to consumer group offset commits (with `checkpointLocation` in Spark) resolved this. Spark now commits the last processed offset to Kafka after each micro-batch. On restart, it resumes from the committed offset.

**Lesson:** Streaming applications must always persist consumer offsets. "Latest" is acceptable only for live monitoring with no gap-sensitivity; for analytics pipelines, every event matters.

---

### Non-Blocking Kafka Producers

The initial implementation used a synchronous Kafka producer inside the FastAPI request handler. Under load, this increased the P99 latency of API responses by 15–40ms — the time to wait for Kafka broker acknowledgement.

The fix was wrapping the Kafka `send()` call in `asyncio.create_task()`. This schedules the publish as a background coroutine and returns the HTTP response immediately. The producer now runs concurrently with the next incoming request.

**Lesson:** Any I/O that is not required to compute the HTTP response (logging, telemetry, notifications) should be async fire-and-forget. Blocking on non-critical I/O directly degrades API latency.

---

### Spark Window Aggregations on Unordered Events

Events from three different services arrive at Kafka in roughly timestamp order, but not exactly. A Payment Service event timestamped at T+5ms might arrive in Kafka after a User Service event at T+200ms.

Naive window aggregations based on `processing_time` ignore event timestamps entirely. This produces correct-looking charts that are subtly wrong when traffic is uneven across services.

The proper solution is event-time windowing with a watermark, but implementing watermarks correctly (choosing the right delay) required several iterations. The current implementation uses a 5-second watermark, which means events arriving more than 5 seconds late are dropped from window aggregations.

**Lesson:** Event-time streaming is significantly harder than processing-time streaming. Watermarks are a necessary complexity for any pipeline where sources produce data at different rates.

---

## What I Would Do Differently

**1. Start with structured logging from day one**
Early in the project, microservices logged plain text strings. Extracting fields from text logs in Spark is painful and brittle. Switching to structured JSON from the beginning would have saved significant debugging time.

**2. Use OpenTelemetry for trace propagation**
The custom `request_id` approach works but is non-standard. Any real-world integration (with Jaeger, Datadog, or any commercial APM) would require replacing it. Starting with the OTel SDK would have made the tracing implementation production-compatible from the start.

**3. Design the Elasticsearch index schema earlier**
The mapping for `logs-*` was changed several times during development, requiring full index deletion and Spark replay each time. Settling on a stable schema (including whether fields are `keyword` or `text`) before writing production volumes saves significant rework.

---

## Engineering Insights

**Eventual consistency is a real trade-off, not a buzzword.**
Events appear on the dashboard 1–5 seconds after they occur. This is fine for aggregated metrics but would be unacceptable for use cases requiring immediate feedback (e.g., rate limiting decisions). Understanding exactly which operations can tolerate eventual consistency and which cannot is a real architectural skill.

**The hardest part of observability is structured data.**
Collecting logs is easy. Making them queryable, aggregatable, and searchable at scale requires discipline at the source. Every field that needs to be filterable must be `keyword` typed. Every field that needs full-text search must be `text` typed. Getting this right early matters.

**Decoupling has real costs.**
Adding Kafka between the services and Elasticsearch solved the coupling problem but added operational complexity (Zookeeper, consumer group management, offset tracking) and introduced a new failure mode (Kafka lag). Good architecture solves one problem while creating smaller, more manageable ones.

---

## Reflection

This project succeeded in its primary goal: understanding the internal mechanics of a distributed observability pipeline.

The most valuable outcome was not the working dashboard — it was the debugging process. Tracing why events were missing from dashboards led through Kafka consumer group offsets, Spark watermark configuration, Elasticsearch mapping conflicts, and Docker network resolution issues. Each investigation revealed a layer of the system that documentation alone could not explain.

Building a distributed system from scratch, even a simplified one, provides a mental model that is qualitatively different from reading about how Kafka or Spark work in isolation.
