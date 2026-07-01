from fastapi import FastAPI

app = FastAPI(title="Analytics API", description="Reads log analytics from Elasticsearch.", version="1.0.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-api"}


@app.get("/ready")
def ready():
    return {"status": "ready", "service": "analytics-api"}


@app.get("/metrics")
def metrics():
    return {"status": "ok", "metric": "request_count"}


@app.get("/errors")
def errors():
    return {"status": "ok", "metric": "error_rate"}


@app.get("/latency")
def latency():
    return {"status": "ok", "metric": "avg_latency"}


@app.get("/services")
def services():
    return {"status": "ok", "services": ["user-service", "order-service", "payment-service"]}


@app.get("/events")
def events():
    return {"status": "ok", "events": []}
