from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from .routes import router

app = FastAPI(
    title="Analytics API",
    description="Reads log analytics from Elasticsearch.",
    version="1.0.0",
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.include_router(router)
