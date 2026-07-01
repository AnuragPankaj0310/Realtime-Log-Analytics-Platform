from fastapi import APIRouter, Request

from .schemas import CreatePaymentRequest, PaymentEvent
from .utils import current_timestamp, generate_request_id, get_client_ip, random_response_time

router = APIRouter()


def publish_event(event: PaymentEvent) -> bool:
    return True


@router.post("/payments")
async def create_payment(payload: CreatePaymentRequest, request: Request):
    event = PaymentEvent(
        event="payment_created",
        endpoint="/payments",
        method=request.method,
        payment_id=payload.payment_id,
        response_time_ms=random_response_time(),
        ip_address=get_client_ip(request),
        timestamp=current_timestamp(),
    )
    publish_event(event)
    return {"status": "success", "message": "Payment created", "request_id": generate_request_id()}
