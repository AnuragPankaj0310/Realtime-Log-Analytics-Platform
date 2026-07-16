import asyncio
import httpx
import os
import uuid
from time import perf_counter

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from .producer import producer
from .schemas import CreateOrderRequest, OrderEvent
from .utils import current_timestamp, generate_request_id, get_client_ip

router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)

# In-memory order storage (data is lost on restart — acceptable for this demo scope)
orders = {}


def _emit_event(
    request: Request,
    event_name: str,
    status_code: int,
    response_time_ms: int,
    order_id: str | None = None,
    trace_id: str | None = None,
    request_payload: str | None = None,
) -> None:
    if not trace_id:
        trace_id = request.headers.get("x-trace-id") or str(uuid.uuid4())
    span_id = str(uuid.uuid4())
    parent_span_id = request.headers.get("x-span-id")
    correlation_id = request.headers.get("x-correlation-id") or trace_id
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())

    event = OrderEvent(
        event=event_name,
        operation=event_name,
        endpoint=request.url.path,
        method=request.method,
        order_id=order_id,
        trace_id=trace_id,
        span_id=span_id,
        parent_span_id=parent_span_id,
        request_id=req_id,
        status="success" if status_code < 400 else "error",
        status_code=status_code,
        response_time_ms=response_time_ms,
        ip_address=get_client_ip(request),
        hostname=os.environ.get("HOSTNAME", "unknown"),
        pod=os.environ.get("HOSTNAME", "unknown"),
        container="order-service",
        user_agent=request.headers.get("user-agent"),
        headers=dict(request.headers),
        request_payload=request_payload,
        correlation_id=correlation_id,
        message=f"Handled {event_name}",
        timestamp=current_timestamp(),
    )
    producer.publish_event(event)


# Protect downstreams with a concurrency limit
order_semaphore = asyncio.Semaphore(200)


@router.post("", status_code=201)
async def create_order(payload: CreateOrderRequest, request: Request):
    started_at = perf_counter()
    status_code = 500
    try:
        orders[payload.order_id] = payload.model_dump()
        trace_id = request.headers.get("x-trace-id")

        span_id = str(uuid.uuid4())
        correlation_id = request.headers.get("x-correlation-id") or trace_id

        async with order_semaphore:
            payment_payload = {
                "payment_id": str(uuid.uuid4()),
                "order_id": payload.order_id,
                "amount": payload.amount,
            }
            headers = {}
            if trace_id:
                headers["X-Trace-ID"] = trace_id
            headers["X-Span-ID"] = span_id
            headers["X-Correlation-ID"] = correlation_id

            client = request.app.state.client
            resp = await client.post(
                "http://payment-service:8000/payments",
                json=payment_payload,
                headers=headers,
            )
            resp.raise_for_status()

        status_code = 201
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "created",
                "message": "Order created and payment processed",
                "request_id": generate_request_id(),
                "order": orders[payload.order_id],
                "payment": resp.json(),
            },
        )
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        raise HTTPException(
            status_code=status_code, detail=f"Payment failed: {exc.response.text}"
        )
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    finally:
        _emit_event(
            request,
            "order_created",
            status_code,
            int((perf_counter() - started_at) * 1000),
            payload.order_id,
            request.headers.get("x-trace-id"),
            payload.model_dump_json(),
        )


@router.get("/health")
async def health():
    return {"service": "order-service", "status": "healthy"}


@router.get("/{order_id}")
async def get_order(order_id: str, request: Request):
    started_at = perf_counter()
    status_code = 500
    try:
        order = orders.get(order_id)
        if order is None:
            status_code = 404
            raise HTTPException(status_code=404, detail="Order not found")
        status_code = 200
        return order
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    finally:
        _emit_event(
            request,
            "order_fetched",
            status_code,
            int((perf_counter() - started_at) * 1000),
            order_id,
        )
