from fastapi import APIRouter, Request

from .producer import producer
from .schemas import CreateOrderRequest, OrderEvent
from .utils import current_timestamp, generate_request_id, get_client_ip, random_response_time

router = APIRouter()


def publish_event(event: OrderEvent) -> bool:
    producer.publish_event(event)
    return True


@router.post("/orders")
async def create_order(payload: CreateOrderRequest, request: Request):
    event = OrderEvent(
        event="order_created",
        endpoint="/orders",
        method=request.method,
        order_id=payload.order_id,
        response_time_ms=random_response_time(),
        ip_address=get_client_ip(request),
        timestamp=current_timestamp(),
    )
    publish_event(event)
    return {"status": "success", "message": "Order created", "request_id": generate_request_id()}
