from fastapi import APIRouter

router = APIRouter()


@router.get("/metrics")
def metrics():
    return {"status": "ok", "metric": "request_count"}
