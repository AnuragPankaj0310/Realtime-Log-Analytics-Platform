import json
import asyncio
import traceback
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel

from .elastic import es, INDEX
from .rate_limiter import rate_limit
from .redis_client import redis_client
from .metrics import MetricsService

router = APIRouter()

# ----------------- CACHING -----------------
def get_cached(key: str):
    data = redis_client.get(key)
    return json.loads(data) if data else None

def set_cached(key: str, data: dict, expire: int = 10):
    redis_client.setex(key, expire, json.dumps(data))

# ----------------- HEALTH -----------------
@router.get("/health")
def health():
    return {"status": "ok", "service": "analytics-api"}

@router.get("/ready")
def ready():
    return {"status": "ready", "service": "analytics-api"}

# ----------------- ANALYTICS DASHBOARD -----------------
@router.get("/system/overview")
def get_system_overview(time_range: str = "15m", _: None = Depends(rate_limit)):
    try:
        metrics_data = MetricsService.get_metrics(time_range)["metrics"]
        return metrics_data
    except Exception as e:
        print(f"Error in /system/overview: {e}")
        return {}

@router.get("/analytics")
def get_analytics(time_range: str = "15m", _: None = Depends(rate_limit)):
    try:
        return MetricsService.get_metrics(time_range)["metrics"]
    except Exception as e:
        print(f"Error in /analytics: {e}")
        return {}

@router.get("/services")
def get_services(time_range: str = "15m", _: None = Depends(rate_limit)):
    try:
        # All dashboard tabs consume identical unified metrics array
        metrics_data = MetricsService.get_metrics(time_range)["metrics"]
        return metrics_data.get("traffic_by_service", [])
    except Exception as e:
        print(f"Error in get_services: {e}", flush=True)
        return []

@router.get("/services/{service_id}/details")
def get_service_details(service_id: str, time_range: str = "15m", _: None = Depends(rate_limit)):
    try:
        return MetricsService.get_service_details(service_id, time_range)
    except Exception as e:
        print(f"Error in get_service_details: {e}", flush=True)
        return {"error": "Internal server error"}

# ----------------- TRACES -----------------
@router.get("/traces/recent")
def get_recent_traces(_: None = Depends(rate_limit)):
    try:
        response = es.search(
            index="raw-logs",
            size=0,
            query={"range": {"timestamp": {"gte": "now-1h"}}}, # Increased to 1h for testing
            aggs={
                "traces": {
                    "terms": {"field": "trace_id.keyword", "size": 100, "order": {"latest_timestamp": "desc"}},
                    "aggs": {
                        "latest_timestamp": {"max": {"field": "timestamp"}},
                        "top_hits": {
                            "top_hits": {
                                "size": 1,
                                "sort": [{"timestamp": {"order": "asc"}}]
                            }
                        }
                    }
                }
            }
        )
        
        recent_traces = []
        for bucket in response.get("aggregations", {}).get("traces", {}).get("buckets", []):
            trace_id = bucket["key"]
            hits = bucket["top_hits"]["hits"]["hits"]
            if hits:
                source = hits[0]["_source"]
                status_code = source.get("status_code")
                if status_code is not None:
                    is_error = status_code >= 400
                else:
                    is_error = str(source.get("status", "")).lower() == "error"

                recent_traces.append({
                    "trace_id": trace_id,
                    "timestamp": source.get("timestamp"),
                    "service": source.get("service"),
                    "duration": source.get("response_time_ms", 0),
                    "status": "error" if is_error else "ok"
                })
                
        return recent_traces
    except Exception as e:
        print(f"Error in get_recent_traces: {e}", flush=True)
        return []

@router.get("/trace/{trace_id}")
def get_trace(trace_id: str, _: None = Depends(rate_limit)):
    try:
        response = es.search(
            index="raw-logs",
            size=1000,
            query={"term": {"trace_id.keyword": trace_id}},
            sort=[{"timestamp": {"order": "asc"}}]
        )
        hits = response.get("hits", {}).get("hits", [])
        
        spans_map = {}
        roots = []
        
        for hit in hits:
            src = hit["_source"]
            span_id = src.get("span_id") or hit["_id"]
            
            span = {
                "trace_id": trace_id,
                "span_id": span_id,
                "parent_span_id": src.get("parent_span_id"),
                "service": src.get("service", "unknown"),
                "operation": src.get("operation", "request"),
                "endpoint": src.get("endpoint") or src.get("path"),
                "method": src.get("method"),
                "status": "error" if (src.get("status_code") and src.get("status_code", 200) >= 400) or str(src.get("status")).lower() == "error" else "ok",
                "status_code": src.get("status_code", 200),
                "duration": src.get("response_time_ms", 0),
                "start_time": src.get("timestamp"),
                "end_time": src.get("timestamp"), # We would calculate this if we had proper start/end pairs instead of single logs
                "hostname": src.get("hostname"),
                "pod": src.get("pod"),
                "container": src.get("container"),
                "ip_address": src.get("ip_address"),
                "user_agent": src.get("user_agent"),
                "headers": src.get("headers", {}),
                "request_payload": src.get("request_payload"),
                "response_payload": src.get("response_payload"),
                "correlation_id": src.get("correlation_id"),
                "message": src.get("message"),
                "children": [],
                "depth": 0,
                "critical_path": False
            }
            spans_map[span_id] = span

        # Build tree
        for span_id, span in spans_map.items():
            parent_id = span.get("parent_span_id")
            if parent_id and parent_id in spans_map and parent_id != span_id:
                spans_map[parent_id]["children"].append(span)
            else:
                roots.append(span)
                
        def calc_depth(node, current_depth):
            node["depth"] = current_depth
            for child in node["children"]:
                calc_depth(child, current_depth + 1)
                
        for root in roots:
            calc_depth(root, 0)
            root["critical_path"] = True
            
        return {"trace_id": trace_id, "spans": roots, "flat_spans": list(spans_map.values())}
    except Exception as e:
        print(f"Error in get_trace: {e}")
        return {"trace_id": trace_id, "spans": [], "flat_spans": []}

# ----------------- LOGS -----------------
def format_log(src):
    return {
        "timestamp": src.get("timestamp"),
        "severity": "ERROR" if (src.get("status_code") and src.get("status_code", 200) >= 400) or str(src.get("status")).lower() == "error" else "INFO",
        "service": src.get("service"),
        "method": src.get("method"),
        "endpoint": src.get("endpoint"),
        "latency": src.get("response_time_ms"),
        "message": src.get("message") or f"{src.get('method')} {src.get('endpoint')} [{src.get('status_code')}]",
        "trace_id": src.get("trace_id"),
        "correlation_id": src.get("correlation_id"),
        "span_id": src.get("span_id"),
        "payload": src.get("request_payload"),
    }

@router.get("/logs/stream")
@router.get("/logs/live")
async def stream_logs(service: Optional[str] = None):
    async def event_generator():
        last_timestamp = "now-1m"
        while True:
            try:
                must_queries = [{"range": {"timestamp": {"gt": last_timestamp}}}]
                if service:
                    must_queries.append({"term": {"service.keyword": service}})

                response = es.search(
                    index="raw-logs",
                    size=100,
                    query={"bool": {"must": must_queries}},
                    sort=[{"timestamp": {"order": "asc"}}]
                )
                hits = response.get("hits", {}).get("hits", [])
                for hit in hits:
                    source = hit["_source"]
                    last_timestamp = source["timestamp"]
                    formatted = format_log(source)
                    yield f"data: {json.dumps(formatted)}\n\n"
            except Exception as e:
                pass
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/logs")
def get_logs(limit: int = 100, service: Optional[str] = None, severity: Optional[str] = None, _: None = Depends(rate_limit)):
    must_queries = []
    if service:
        must_queries.append({"term": {"service.keyword": service}})
    if severity:
        if severity.upper() == "ERROR":
            must_queries.append({"range": {"status_code": {"gte": 400}}})
        elif severity.upper() == "INFO":
            must_queries.append({"range": {"status_code": {"lt": 400}}})

    try:
        response = es.search(
            index="raw-logs",
            size=limit,
            query={"bool": {"must": must_queries}} if must_queries else {"match_all": {}},
            sort=[{"timestamp": {"order": "desc"}}]
        )
        return [format_log(hit["_source"]) for hit in response.get("hits", {}).get("hits", [])]
    except Exception:
        return []

@router.get("/logs/search")
def search_logs(q: str, limit: int = 100, _: None = Depends(rate_limit)):
    if not q:
        return []
    try:
        response = es.search(
            index="raw-logs",
            size=limit,
            query={
                "multi_match": {
                    "query": q,
                    "fields": ["message", "trace_id", "service", "endpoint", "correlation_id"]
                }
            },
            sort=[{"timestamp": {"order": "desc"}}]
        )
        return [format_log(hit["_source"]) for hit in response.get("hits", {}).get("hits", [])]
    except Exception:
        return []

@router.get("/logs/{trace_id}")
def get_trace_logs(trace_id: str, _: None = Depends(rate_limit)):
    try:
        response = es.search(
            index="raw-logs",
            size=1000,
            query={"term": {"trace_id.keyword": trace_id}},
            sort=[{"timestamp": {"order": "asc"}}]
        )
        return [format_log(hit["_source"]) for hit in response.get("hits", {}).get("hits", [])]
    except Exception:
        return []

@router.get("/logs/service/{service_name}")
def get_service_logs(service_name: str, limit: int = 100, _: None = Depends(rate_limit)):
    return get_logs(limit=limit, service=service_name)

# ----------------- SERVICES / DRILLDOWN -----------------
# ----------------- ALERTS & SEARCH -----------------
@router.get("/alerts")
def alerts(_: None = Depends(rate_limit)):
    cache_key = "api:alerts:v2"
    cached = get_cached(cache_key)
    if cached:
        return cached

    try:
        response = es.search(
            index="raw-logs",
            size=0,
            query={"range": {"timestamp": {"gte": "now-15m"}}},
            aggs={
                "services": {
                    "terms": {"field": "service.keyword", "size": 10},
                    "aggs": {
                        "errors": {"filter": {"range": {"status_code": {"gte": 500}}}},
                        "p95_latency": {"percentiles": {"field": "response_time_ms", "percents": [95]}}
                    }
                }
            },
        )

        alerts = []
        for bucket in response.get("aggregations", {}).get("services", {}).get("buckets", []):
            name = bucket["key"]
            reqs = bucket["doc_count"]
            errs = bucket["errors"]["doc_count"]
            error_rate = errs / reqs if reqs > 0 else 0
            p95 = bucket.get("p95_latency", {}).get("values", {}).get("95.0") or 0

            # Helper to get state
            def get_alert_state(alert_id):
                state_data = redis_client.get(f"alert_state:{alert_id}")
                return state_data.decode() if state_data else "Active"

            if p95 > 300:
                alert_id = f"{name}:latency_p95"
                alerts.append({
                    "id": alert_id,
                    "severity": "Warning",
                    "reason": f"{name} P95 latency exceeded threshold ({int(p95)}ms)",
                    "confidence": 90,
                    "recommendation": f"Check traces for {name}",
                    "service": name,
                    "timestamp": "now",
                    "trace_id": None,
                    "state": get_alert_state(alert_id)
                })
            if error_rate > 0.05:
                alert_id = f"{name}:error_rate"
                alerts.append({
                    "id": alert_id,
                    "severity": "Critical",
                    "reason": f"{name} error rate is {(error_rate*100):.1f}%",
                    "confidence": 99,
                    "recommendation": f"Check recent traces for {name}",
                    "service": name,
                    "timestamp": "now",
                    "trace_id": None,
                    "state": get_alert_state(alert_id)
                })

        set_cached(cache_key, alerts, 5)
        return alerts
    except Exception:
        return []

class AlertStateRequest(BaseModel):
    alert_id: str
    state: str

@router.post("/alerts/state")
def set_alert_state(req: AlertStateRequest):
    if req.state not in ["Active", "Acknowledged", "Resolved"]:
        raise HTTPException(status_code=400, detail="Invalid state")
    redis_client.set(f"alert_state:{req.alert_id}", req.state)
    # Also invalidate alert cache
    redis_client.delete("api:alerts:v2")
    return {"status": "success", "alert_id": req.alert_id, "state": req.state}

@router.get("/search")
def search_global(q: str, _: None = Depends(rate_limit)):
    if not q:
        return {"results": []}
        
    try:
        response = es.search(
            index="raw-logs",
            size=50,
            query={
                "multi_match": {
                    "query": q,
                    "fields": ["message", "trace_id", "service", "endpoint", "correlation_id"]
                }
            },
            sort=[{"timestamp": {"order": "desc"}}]
        )
        
        hits = [hit["_source"] for hit in response.get("hits", {}).get("hits", [])]
        return {"results": hits}
    except Exception:
        return {"results": []}

# ----------------- FAILURE INJECTION -----------------
class FailureConfigRequest(BaseModel):
    service: str
    delay_ms: int = 0
    error_rate: float = 0.0
    drop_requests: bool = False

@router.post("/failure-injection")
def set_failure_injection(config: FailureConfigRequest):
    cache_key = f"failure_config:{config.service}"
    if config.delay_ms == 0 and config.error_rate == 0.0 and not config.drop_requests:
        redis_client.delete(cache_key)
        return {"status": "cleared", "service": config.service}
    
    redis_client.set(cache_key, json.dumps({
        "delay_ms": config.delay_ms,
        "error_rate": config.error_rate,
        "drop_requests": config.drop_requests
    }))
    return {"status": "injected", "config": config.model_dump()}

@router.get("/rca")
def get_rca(_: None = Depends(rate_limit)):
    try:
        response = es.search(
            index="raw-logs",
            size=1,
            query={"range": {"status_code": {"gte": 500}}},
            sort=[{"timestamp": {"order": "desc"}}]
        )
        hits = response.get("hits", {}).get("hits", [])
        if not hits:
             return {"message": "No critical anomalies detected. System is stable.", "root_cause": None}
        
        trace_id = hits[0]["_source"].get("trace_id")
        if not trace_id:
             return {"message": "A failure occurred but lacks a trace_id.", "root_cause": "unknown"}

        trace_data = get_trace(trace_id, None)
        trace_spans = trace_data.get("flat_spans", [])
        
        root_cause = None
        for span in trace_spans:
            if span.get("status_code", 200) >= 500:
                root_cause = span["service"]
                break
                
        if root_cause:
            err_spans = [s for s in trace_spans if s.get("status_code", 200) >= 500]
            slow_spans = [s for s in trace_spans if s.get("duration", 0) > 100]
            evidence = []
            if err_spans:
                evidence.append(f"{len(err_spans)} spans returned HTTP 500+ in this trace")
                evidence.append(f"Root cause identified in {root_cause} service")
            if slow_spans:
                evidence.append(f"{len(slow_spans)} spans took >100ms")
                
            return {
                "incident": "Service Failure Detected",
                "root_cause": root_cause,
                "trace_id": trace_id,
                "summary": f"Anomalies detected in trace {trace_id} originating from {root_cause}.",
                "evidence": evidence,
                "likely_cause": f"Errors in {root_cause} endpoint: {err_spans[0].get('endpoint', 'unknown') if err_spans else 'unknown'}",
                "confidence": 94,
                "recommendation": [
                    f"Inspect logs for {root_cause}",
                    f"Check dependencies of {root_cause}"
                ]
            }
        
        return {"incident": "No critical anomalies detected. System is stable.", "root_cause": None}
    except Exception:
        return {"incident": "No critical anomalies detected. System is stable.", "root_cause": None}
