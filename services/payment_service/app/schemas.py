from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreatePaymentRequest(BaseModel):
    payment_id: str
    order_id: str
    amount: float


class PaymentEvent(BaseModel):
    service: str = Field(default="payment-service")
    event: str
    endpoint: str
    method: str
    payment_id: Optional[str] = None
    status: str = "success"
    response_time_ms: int = 0
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
