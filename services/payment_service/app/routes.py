import os
import uuid
from time import perf_counter

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from .producer import producer
from .schemas import CreatePaymentRequest, PaymentEvent
from .utils import current_timestamp, generate_request_id, get_client_ip

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)

# In-memory payment storage (data is lost on restart — acceptable for this demo scope)
payments = {}


def _emit_event(
    request: Request,
    event_name: str,
    status_code: int,
    response_time_ms: int,
    payment_id: str | None = None,
    trace_id: str | None = None,
    request_payload: str | None = None,
) -> None:
    if not trace_id:
        trace_id = request.headers.get("x-trace-id") or str(uuid.uuid4())
    span_id = str(uuid.uuid4())
    parent_span_id = request.headers.get("x-span-id")
    correlation_id = request.headers.get("x-correlation-id") or trace_id
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())

    event = PaymentEvent(
        event=event_name,
        operation=event_name,
        endpoint=request.url.path,
        method=request.method,
        payment_id=payment_id,
        trace_id=trace_id,
        span_id=span_id,
        parent_span_id=parent_span_id,
        correlation_id=correlation_id,
        request_id=req_id,
        status="success" if status_code < 400 else "error",
        status_code=status_code,
        response_time_ms=response_time_ms,
        ip_address=get_client_ip(request),
        hostname=os.environ.get("HOSTNAME", "unknown"),
        pod=os.environ.get("HOSTNAME", "unknown"),
        container="payment-service",
        user_agent=request.headers.get("user-agent"),
        headers=dict(request.headers),
        request_payload=request_payload,
        message=f"Handled {event_name}",
        timestamp=current_timestamp(),
    )
    producer.publish_event(event)


@router.post("", status_code=201)
async def create_payment(payload: CreatePaymentRequest, request: Request):
    started_at = perf_counter()
    status_code = 500
    try:
        payments[payload.payment_id] = payload.model_dump()
        status_code = 201
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "created",
                "message": "Payment created",
                "request_id": generate_request_id(),
                "payment": payments[payload.payment_id],
            },
        )
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    finally:
        _emit_event(
            request,
            "payment_created",
            status_code,
            int((perf_counter() - started_at) * 1000),
            payload.payment_id,
            request.headers.get("x-trace-id"),
            payload.model_dump_json(),
        )


@router.get("/health")
async def health():
    return {"service": "payment-service", "status": "healthy"}


@router.get("/{payment_id}")
async def get_payment(payment_id: str, request: Request):
    started_at = perf_counter()
    status_code = 500
    try:
        payment = payments.get(payment_id)
        if payment is None:
            status_code = 404
            raise HTTPException(status_code=404, detail="Payment not found")
        status_code = 200
        return payment
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    finally:
        _emit_event(
            request,
            "payment_fetched",
            status_code,
            int((perf_counter() - started_at) * 1000),
            payment_id,
        )
