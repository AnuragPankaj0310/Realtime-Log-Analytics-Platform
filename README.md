# Realtime Log Analytics Platform

A modular real-time log analytics platform built with FastAPI, Kafka, Elasticsearch, Spark, and Docker Compose. The project demonstrates a pipeline for ingesting service events, processing them, and exposing analytics endpoints for monitoring and observability.

## What’s included

- User, order, and payment services with FastAPI
- Kafka-based event publishing for service activity
- Elasticsearch-backed analytics API
- Spark Structured Streaming processing skeleton
- Nginx reverse proxy for routing
- Docker Compose-based local deployment
- CI workflow for build and validation

## Quick start

1. Install Docker and Docker Compose.
2. From the repository root, run:
   ```bash
   docker compose up --build
   ```
3. Open the following endpoints:
   - User Service: http://localhost:8001/
   - Order Service: http://localhost:8002/
   - Payment Service: http://localhost:8003/
   - Analytics API: http://localhost:8004/
   - Nginx: http://localhost:8080/

## Verification

The repository includes a basic test suite for the User Service and a compile check for the Python modules.

```bash
.
.venv\Scripts\python.exe -m pytest services/user_service/tests/test_routes.py
```
