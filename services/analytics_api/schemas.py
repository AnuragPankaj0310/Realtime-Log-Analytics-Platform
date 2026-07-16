from pydantic import BaseModel
from typing import Dict, List, Any


class LatencyMetrics(BaseModel):
    avg: float = 0.0
    p50: float = 0.0
    p90: float = 0.0
    p95: float = 0.0
    p99: float = 0.0


class TrafficOverTime(BaseModel):
    time: str
    requests: int
    errors: int
    latency_p50: float = 0.0
    latency_p90: float = 0.0
    latency_p95: float = 0.0
    latency_p99: float = 0.0


class EndpointMetrics(BaseModel):
    endpoint: str
    requests: int
    avg_latency: float
    p95_latency: float = 0.0
    p99_latency: float = 0.0
    error_rate: float = 0.0
    status_distribution: Dict[str, int] = {}


class ServiceMetrics(BaseModel):
    service: str
    availability: float
    throughput: float
    errors: float
    latency: LatencyMetrics


class LatencyBucket(BaseModel):
    bucket: str
    count: int


class UnifiedMetricsResponse(BaseModel):
    timestamp: str
    window: str
    availability: float
    throughput: float
    errors: float
    latency: LatencyMetrics

    traffic_over_time: List[TrafficOverTime] = []
    top_endpoints: List[EndpointMetrics] = []
    slow_endpoints: List[EndpointMetrics] = []
    traffic_by_service: List[ServiceMetrics] = []
    http_status_distribution: List[Dict[str, Any]] = []
    latency_histogram: List[LatencyBucket] = []
    heatmap: List[List[Any]] = []
