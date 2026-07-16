from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreateOrderRequest(BaseModel):
    order_id: str
    customer_id: str
    amount: float


class OrderEvent(BaseModel):
    service: str = Field(default="order-service")
    event: str
    endpoint: str
    method: str
    order_id: Optional[str] = None
    trace_id: str | None = None
    span_id: str | None = None
    parent_span_id: str | None = None
    correlation_id: str | None = None
    request_id: str | None = None
    operation: str | None = None
    status: str = "success"
    status_code: int = 200
    response_time_ms: int = 0
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    pod: Optional[str] = None
    container: Optional[str] = None
    user_agent: Optional[str] = None
    headers: Optional[dict] = None
    request_payload: Optional[str] = None
    response_payload: Optional[str] = None
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
