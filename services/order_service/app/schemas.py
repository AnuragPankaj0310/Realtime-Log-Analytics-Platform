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
    status: str = "success"
    response_time_ms: int = 0
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
