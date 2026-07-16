import json
from datetime import datetime, timezone
from typing import Dict, Any

from .elastic import es
from .redis_client import redis_client


class MetricsService:
    @staticmethod
    def get_cached(key: str):
        data = redis_client.get(key)
        return json.loads(data) if data else None

    @staticmethod
    def set_cached(key: str, data: dict, expire: int = 5):
        redis_client.setex(key, expire, json.dumps(data))

    @staticmethod
    def get_metrics(time_range: str = "15m") -> Dict[str, Any]:
        """
        Single source of truth for all aggregated metrics.
        Queries specialized pre-aggregated indices (global-metrics, service-metrics, endpoint-metrics)
        """
        cache_key = f"api:metrics:v4:{time_range}"
        cached = MetricsService.get_cached(cache_key)
        if cached:
            return cached

        # Determine interval based on time range
        interval = "1m"
        window_seconds = 15 * 60
        if time_range == "1h":
            interval = "5m"
            window_seconds = 60 * 60
        elif time_range == "6h":
            interval = "15m"
            window_seconds = 6 * 60 * 60
        elif time_range == "24h":
            interval = "1h"
            window_seconds = 24 * 60 * 60
        elif time_range == "7d":
            interval = "6h"
            window_seconds = 7 * 24 * 60 * 60

        try:
            base_query = {
                "bool": {
                    "must": [
                        {"range": {"timestamp": {"gte": f"now-{time_range}"}}},
                        {"range": {"response_time_ms": {"gte": 0}}},
                    ]
                }
            }

            # 1. Global Metrics
            global_res = es.search(
                index="raw-logs",
                size=0,
                query=base_query,
                aggs={
                    "errors": {"filter": {"range": {"status_code": {"gte": 400}}}},
                    "avg_latency": {"avg": {"field": "response_time_ms"}},
                    "latency": {
                        "percentiles": {
                            "field": "response_time_ms",
                            "percents": [50, 90, 95, 99],
                        }
                    },
                    "latency_histogram": {
                        "range": {
                            "field": "response_time_ms",
                            "ranges": [
                                {"to": 50, "key": "0-50ms"},
                                {"from": 50, "to": 100, "key": "50-100ms"},
                                {"from": 100, "to": 200, "key": "100-200ms"},
                                {"from": 200, "to": 500, "key": "200-500ms"},
                                {"from": 500, "to": 1000, "key": "500ms-1s"},
                                {"from": 1000, "key": ">1s"},
                            ],
                        }
                    },
                    "status_200": {"filter": {"term": {"status_code": 200}}},
                    "status_404": {"filter": {"term": {"status_code": 404}}},
                    "status_500": {"filter": {"term": {"status_code": 500}}},
                    "traffic_over_time": {
                        "date_histogram": {
                            "field": "timestamp",
                            "fixed_interval": interval,
                        },
                        "aggs": {
                            "errors": {
                                "filter": {"range": {"status_code": {"gte": 400}}}
                            },
                            "latency": {
                                "percentiles": {
                                    "field": "response_time_ms",
                                    "percents": [50, 90, 95, 99],
                                }
                            },
                            "latency_histogram": {
                                "range": {
                                    "field": "response_time_ms",
                                    "ranges": [
                                        {"to": 50, "key": "0-50ms"},
                                        {"from": 50, "to": 100, "key": "50-100ms"},
                                        {"from": 100, "to": 200, "key": "100-200ms"},
                                        {"from": 200, "to": 500, "key": "200-500ms"},
                                        {"from": 500, "to": 1000, "key": "500ms-1s"},
                                        {"from": 1000, "key": ">1s"},
                                    ],
                                }
                            },
                        },
                    },
                },
            )

            # 2. Service Metrics
            service_res = es.search(
                index="raw-logs",
                size=0,
                query=base_query,
                aggs={
                    "services": {
                        "terms": {"field": "service.keyword", "size": 20},
                        "aggs": {
                            "errors": {
                                "filter": {"range": {"status_code": {"gte": 400}}}
                            },
                            "avg_latency": {"avg": {"field": "response_time_ms"}},
                            "latency": {
                                "percentiles": {
                                    "field": "response_time_ms",
                                    "percents": [50, 90, 95, 99],
                                }
                            },
                        },
                    }
                },
            )

            # 3. Endpoint Metrics
            endpoint_res = es.search(
                index="raw-logs",
                size=0,
                query=base_query,
                aggs={
                    "endpoints": {
                        "terms": {
                            "field": "endpoint.keyword",
                            "size": 20,
                            "order": {"_count": "desc"},
                        },
                        "aggs": {
                            "errors": {
                                "filter": {"range": {"status_code": {"gte": 400}}}
                            },
                            "avg_latency": {"avg": {"field": "response_time_ms"}},
                            "latency": {
                                "percentiles": {
                                    "field": "response_time_ms",
                                    "percents": [95, 99],
                                }
                            },
                        },
                    },
                    "slow_endpoints": {
                        "terms": {
                            "field": "endpoint.keyword",
                            "size": 20,
                            "order": {"avg_latency": "desc"},
                        },
                        "aggs": {
                            "errors": {
                                "filter": {"range": {"status_code": {"gte": 400}}}
                            },
                            "avg_latency": {"avg": {"field": "response_time_ms"}},
                            "latency": {
                                "percentiles": {
                                    "field": "response_time_ms",
                                    "percents": [95, 99],
                                }
                            },
                        },
                    },
                },
            )

            g_aggs = global_res.get("aggregations", {})
            total_req = global_res.get("hits", {}).get("total", {}).get("value") or 0
            total_err = g_aggs.get("errors", {}).get("doc_count") or 0

            time_buckets = g_aggs.get("traffic_over_time", {}).get("buckets", [])
            heatmap_data = []
            for time_idx, b in enumerate(time_buckets):
                hist = {
                    r["key"]: r["doc_count"]
                    for r in b.get("latency_histogram", {}).get("buckets", [])
                }
                heatmap_data.append([time_idx, 0, int(hist.get(">1s", 0))])
                heatmap_data.append([time_idx, 1, int(hist.get("500ms-1s", 0))])
                heatmap_data.append([time_idx, 2, int(hist.get("200-500ms", 0))])
                heatmap_data.append([time_idx, 3, int(hist.get("100-200ms", 0))])
                heatmap_data.append([time_idx, 4, int(hist.get("50-100ms", 0))])
                heatmap_data.append([time_idx, 5, int(hist.get("0-50ms", 0))])

            global_latency_raw = g_aggs.get("latency", {}).get("values", {})
            hist_global = {
                r["key"]: r["doc_count"]
                for r in g_aggs.get("latency_histogram", {}).get("buckets", [])
            }

            # Build unified response
            res = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "window": time_range,
                "availability": max(0.0, 100.0 - (total_err / max(total_req, 1) * 100)),
                "throughput": round(total_req / window_seconds, 2),
                "errors": total_err / max(total_req, 1),
                "latency": {
                    "avg": g_aggs.get("avg_latency", {}).get("value") or 0,
                    "p50": global_latency_raw.get("50.0") or 0,
                    "p90": global_latency_raw.get("90.0") or 0,
                    "p95": global_latency_raw.get("95.0") or 0,
                    "p99": global_latency_raw.get("99.0") or 0,
                },
                "traffic_over_time": [
                    {
                        "time": b["key_as_string"],
                        "requests": b.get("doc_count") or 0,
                        "errors": b.get("errors", {}).get("doc_count") or 0,
                        "latency_p50": b.get("latency", {})
                        .get("values", {})
                        .get("50.0")
                        or 0,
                        "latency_p90": b.get("latency", {})
                        .get("values", {})
                        .get("90.0")
                        or 0,
                        "latency_p95": b.get("latency", {})
                        .get("values", {})
                        .get("95.0")
                        or 0,
                        "latency_p99": b.get("latency", {})
                        .get("values", {})
                        .get("99.0")
                        or 0,
                    }
                    for b in time_buckets
                ],
                "top_endpoints": [
                    {
                        "endpoint": b["key"],
                        "requests": b.get("doc_count") or 0,
                        "avg_latency": b.get("avg_latency", {}).get("value") or 0,
                        "p95_latency": b.get("latency", {})
                        .get("values", {})
                        .get("95.0")
                        or 0,
                        "p99_latency": b.get("latency", {})
                        .get("values", {})
                        .get("99.0")
                        or 0,
                        "error_rate": (b.get("errors", {}).get("doc_count") or 0)
                        / max(b.get("doc_count") or 1, 1),
                        "status_distribution": {},
                    }
                    for b in endpoint_res.get("aggregations", {})
                    .get("endpoints", {})
                    .get("buckets", [])
                ],
                "slow_endpoints": [
                    {
                        "endpoint": b["key"],
                        "requests": b.get("doc_count") or 0,
                        "avg_latency": b.get("avg_latency", {}).get("value") or 0,
                        "p95_latency": b.get("latency", {})
                        .get("values", {})
                        .get("95.0")
                        or 0,
                        "p99_latency": b.get("latency", {})
                        .get("values", {})
                        .get("99.0")
                        or 0,
                        "error_rate": (b.get("errors", {}).get("doc_count") or 0)
                        / max(b.get("doc_count") or 1, 1),
                        "status_distribution": {},
                    }
                    for b in endpoint_res.get("aggregations", {})
                    .get("slow_endpoints", {})
                    .get("buckets", [])
                ],
                "traffic_by_service": [
                    {
                        "service": b["key"],
                        "availability": max(
                            0.0,
                            100.0
                            - (
                                (b.get("errors", {}).get("doc_count") or 0)
                                / max(b.get("doc_count") or 1, 1)
                                * 100
                            ),
                        ),
                        "throughput": round(
                            (b.get("doc_count") or 0) / window_seconds, 2
                        ),
                        "errors": b.get("errors", {}).get("doc_count") or 0,
                        "latency": {
                            "avg": b.get("avg_latency", {}).get("value") or 0,
                            "p50": b.get("latency", {}).get("values", {}).get("50.0")
                            or 0,
                            "p90": b.get("latency", {}).get("values", {}).get("90.0")
                            or 0,
                            "p95": b.get("latency", {}).get("values", {}).get("95.0")
                            or 0,
                            "p99": b.get("latency", {}).get("values", {}).get("99.0")
                            or 0,
                        },
                    }
                    for b in service_res.get("aggregations", {})
                    .get("services", {})
                    .get("buckets", [])
                ],
                "http_status_distribution": [
                    {
                        "status": "200",
                        "count": int(
                            g_aggs.get("status_200", {}).get("doc_count") or 0
                        ),
                    },
                    {
                        "status": "404",
                        "count": int(
                            g_aggs.get("status_404", {}).get("doc_count") or 0
                        ),
                    },
                    {
                        "status": "500",
                        "count": int(
                            g_aggs.get("status_500", {}).get("doc_count") or 0
                        ),
                    },
                ],
                "latency_histogram": [
                    {"bucket": "0-50ms", "count": int(hist_global.get("0-50ms", 0))},
                    {
                        "bucket": "50-100ms",
                        "count": int(hist_global.get("50-100ms", 0)),
                    },
                    {
                        "bucket": "100-200ms",
                        "count": int(hist_global.get("100-200ms", 0)),
                    },
                    {
                        "bucket": "200-500ms",
                        "count": int(hist_global.get("200-500ms", 0)),
                    },
                    {
                        "bucket": "500ms-1s",
                        "count": int(hist_global.get("500ms-1s", 0)),
                    },
                    {"bucket": ">1s", "count": int(hist_global.get(">1s", 0))},
                ],
                "heatmap": heatmap_data,
            }

            # Simple heatmap data structure: [time_index, bucket_index, count]
            # Heatmap handles global latency over time percentiles

            MetricsService.set_cached(cache_key, res, 2)
            return {
                "metrics": res
            }  # returning nested metrics to keep compatibility with existing frontend payload shape temporarily
        except Exception as e:
            import traceback

            traceback.print_exc()
            print(f"Error fetching metrics from ES: {e}")
            return cached if cached else {}

    @staticmethod
    def get_service_details(service_id: str, time_range: str = "15m") -> Dict[str, Any]:
        """
        Fetches detailed metrics for a specific service.
        """
        cache_key = f"api:service:{service_id}:{time_range}"
        cached = MetricsService.get_cached(cache_key)
        if cached:
            return cached

        empty_schema = {
            "service": service_id,
            "window": time_range,
            "metrics": {
                "requests": 0,
                "errors": 0,
                "error_rate": 0.0,
                "throughput": 0,
                "latency_p50": 0,
                "latency_p90": 0,
                "latency_p95": 0,
                "latency_p99": 0,
                "availability": 100.0,
            },
            "traffic_over_time": [],
            "top_endpoints": [],
            "dependencies": {"incoming": [], "outgoing": []},
        }

        interval = "1m"
        window_seconds = 15 * 60
        if time_range == "1h":
            interval = "5m"
            window_seconds = 60 * 60
        elif time_range == "24h":
            interval = "1h"
            window_seconds = 24 * 60 * 60

        try:
            response = es.search(
                index="raw-logs",
                size=0,
                query={
                    "bool": {
                        "must": [
                            {"range": {"timestamp": {"gte": f"now-{time_range}"}}},
                            {"range": {"response_time_ms": {"gte": 0}}},
                            {"term": {"service.keyword": service_id}},
                        ]
                    }
                },
                aggs={
                    "endpoints": {
                        "terms": {
                            "field": "endpoint.keyword",
                            "size": 10,
                            "order": {"_count": "desc"},
                        },
                        "aggs": {"avg_latency": {"avg": {"field": "response_time_ms"}}},
                    },
                    "traffic_over_time": {
                        "date_histogram": {
                            "field": "timestamp",
                            "fixed_interval": interval,
                        },
                        "aggs": {
                            "errors": {
                                "filter": {"range": {"status_code": {"gte": 400}}}
                            }
                        },
                    },
                    "latency": {
                        "percentiles": {
                            "field": "response_time_ms",
                            "percents": [50, 90, 95, 99],
                        }
                    },
                    "errors": {"filter": {"range": {"status_code": {"gte": 400}}}},
                },
            )

            aggs = response.get("aggregations", {})
            total_requests = response.get("hits", {}).get("total", {}).get("value", 0)
            total_errors = aggs.get("errors", {}).get("doc_count", 0)

            top_endpoints = [
                {
                    "endpoint": b["key"],
                    "requests": b["doc_count"],
                    "avg_latency": b.get("avg_latency", {}).get("value") or 0,
                }
                for b in aggs.get("endpoints", {}).get("buckets", [])
            ]

            traffic_over_time = [
                {
                    "time": b["key_as_string"],
                    "rps": round(
                        b["doc_count"] / 60, 2
                    ),  # Assuming 1m interval approximation for RPS
                    "errors": b.get("errors", {}).get("doc_count", 0),
                }
                for b in aggs.get("traffic_over_time", {}).get("buckets", [])
            ]

            latency_raw = aggs.get("latency", {}).get("values", {})
            error_rate = total_errors / max(total_requests, 1)

            # Static dependency mapping for demo purposes
            dependencies = {"incoming": [], "outgoing": []}
            if service_id == "gateway":
                dependencies["outgoing"] = ["user-service", "order-service"]
            elif service_id == "user-service":
                dependencies["incoming"] = ["gateway"]
                dependencies["outgoing"] = ["order-service"]
            elif service_id == "order-service":
                dependencies["incoming"] = ["gateway", "user-service"]
                dependencies["outgoing"] = ["payment-service"]
            elif service_id == "payment-service":
                dependencies["incoming"] = ["order-service"]

            res = {
                "service": service_id,
                "window": time_range,
                "metrics": {
                    "requests": total_requests,
                    "errors": total_errors,
                    "error_rate": error_rate,
                    "throughput": round(total_requests / window_seconds, 2),
                    "latency_p50": latency_raw.get("50.0") or 0,
                    "latency_p90": latency_raw.get("90.0") or 0,
                    "latency_p95": latency_raw.get("95.0") or 0,
                    "latency_p99": latency_raw.get("99.0") or 0,
                    "availability": max(0, 100.0 - (error_rate * 100)),
                },
                "traffic_over_time": traffic_over_time,
                "top_endpoints": top_endpoints,
                "dependencies": dependencies,
            }

            MetricsService.set_cached(cache_key, res, expire=5)
            return res
        except Exception as e:
            print(f"Error fetching service details: {e}")
            return cached if cached else empty_schema
