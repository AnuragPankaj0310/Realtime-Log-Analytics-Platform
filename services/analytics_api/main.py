import json
from fastapi import FastAPI
from elastic import es, INDEX
from redis_client import redis_client

app = FastAPI(title="Analytics API", description="Reads log analytics from Elasticsearch.", version="1.0.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-api"}


@app.get("/ready")
def ready():
    return {"status": "ready", "service": "analytics-api"}


@app.get("/metrics")
def metrics():
    response = es.search(
        index=INDEX,
        size=100,
        query={"match_all": {}}
    )

    docs = [hit["_source"] for hit in response["hits"]["hits"]]

    return {
        "count": len(docs),
        "metrics": docs
    }


@app.get("/alerts")
def alerts():
    response = es.search(
        index=INDEX,
        size=0,
        aggs={
            "services": {
                "terms": {
                    "field": "service.keyword",
                    "size": 10
                },
                "aggs": {
                    "latest": {
                        "top_hits": {
                            "size": 1,
                            "sort": [
                                {
                                    "window.end": {
                                        "order": "desc"
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        }
    )

    alerts = []

    for bucket in response["aggregations"]["services"]["buckets"]:
        data = bucket["latest"]["hits"]["hits"][0]["_source"]

        if data["average_latency"] > 130:
            alerts.append({
                "service": data["service"],
                "type": "High Latency",
                "value": data["average_latency"]
            })

        if data["error_rate"] > 5:
            alerts.append({
                "service": data["service"],
                "type": "High Error Rate",
                "value": data["error_rate"]
            })

    return {
        "count": len(alerts),
        "alerts": alerts
    }

@app.get("/latency")
def latency():
    return {"status": "ok", "metric": "avg_latency"}


@app.get("/services")
def services():
    return {"status": "ok", "services": ["user-service", "order-service", "payment-service"]}


@app.get("/events")
def events():
    return {"status": "ok", "events": []}


@app.get("/dashboard")
def dashboard():

    cached = redis_client.get("dashboard")
    print("Checking Redis...")

    if cached:
        print("Cache hit")
        return json.loads(cached)

    response = es.search(
        index=INDEX,
        size=1,
        sort=[
            {
                "window.end": {
                    "order": "desc"
                }
            }
        ]
    )

    if not response["hits"]["hits"]:
        return {"message": "No data"}

    data = response["hits"]["hits"][0]["_source"]

    print("Saving to Redis...")
    redis_client.setex(
        "dashboard",
        30,
        json.dumps(data)
    )

    print("Success")
    return data


@app.get("/service/{service_name}")
def service_metrics(service_name: str):
    response = es.search(
        index=INDEX,
        size=100,
        query={
            "term": {
                "service.keyword": service_name
            }
        },
        sort=[
            {
                "window.end": {
                    "order": "desc"
                }
            }
        ]
    )

    return {
        "service": service_name,
        "count": len(response["hits"]["hits"]),
        "metrics": [
            hit["_source"]
            for hit in response["hits"]["hits"]
        ]
    }


@app.get("/summary")
def summary():
    response = es.search(
        index=INDEX,
        size=0,
        aggs={
            "services": {
                "cardinality": {
                    "field": "service.keyword"
                }
            },
            "total_requests": {
                "sum": {
                    "field": "request_count"
                }
            },
            "avg_latency": {
                "avg": {
                    "field": "average_latency"
                }
            },
            "avg_error_rate": {
                "avg": {
                    "field": "error_rate"
                }
            }
        }
    )

    aggs = response["aggregations"]

    return {
        "total_services": aggs["services"]["value"],
        "total_requests": int(aggs["total_requests"]["value"]),
        "average_latency": round(aggs["avg_latency"]["value"], 2),
        "average_error_rate": round(aggs["avg_error_rate"]["value"], 2)
    }


@app.get("/health")
def health():
    return {
        "status":"healthy",
        "elasticsearch":es.ping()
    }


@app.get("/leaderboard")
def leaderboard():
    response = es.search(
        index=INDEX,
        size=0,
        aggs={
            "services": {
                "terms": {
                    "field": "service.keyword",
                    "size": 10
                },
                "aggs": {
                    "requests": {
                        "sum": {
                            "field": "request_count"
                        }
                    },
                    "avg_latency": {
                        "avg": {
                            "field": "average_latency"
                        }
                    }
                }
            }
        }
    )

    buckets = response["aggregations"]["services"]["buckets"]

    return [
        {
            "service": bucket["key"],
            "total_requests": int(bucket["requests"]["value"]),
            "average_latency": round(bucket["avg_latency"]["value"], 2)
        }
        for bucket in buckets
    ]