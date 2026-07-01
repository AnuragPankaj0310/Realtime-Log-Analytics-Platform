from fastapi import FastAPI

from . import routes

app = FastAPI(title="Order Service", description="Handles order events.", version="1.0.0")
app.include_router(routes.router)


@app.get("/")
def root():
    return {"service": "order-service", "status": "running"}


@app.get("/health")
def health():
    return {"service": "order-service", "status": "healthy"}
