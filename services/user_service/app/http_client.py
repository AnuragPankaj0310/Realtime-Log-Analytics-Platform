import httpx
import os

class HttpClient:
    def __init__(self):
        self.client = None
        self.max_connections = int(os.environ.get("HTTP_MAX_CONNECTIONS", 500))
        self.max_keepalive = int(os.environ.get("HTTP_MAX_KEEPALIVE", 100))

    def initialize(self):
        timeout = httpx.Timeout(
            connect=2.0,
            read=10.0,
            write=10.0,
            pool=5.0
        )
        limits = httpx.Limits(
            max_connections=self.max_connections,
            max_keepalive_connections=self.max_keepalive,
        )
        self.client = httpx.AsyncClient(timeout=timeout, limits=limits)

    async def aclose(self):
        if self.client:
            await self.client.aclose()

    async def post(self, url: str, **kwargs):
        if not self.client:
            raise RuntimeError("HttpClient is not initialized")
        return await self.client.post(url, **kwargs)

    async def get(self, url: str, **kwargs):
        if not self.client:
            raise RuntimeError("HttpClient is not initialized")
        return await self.client.get(url, **kwargs)

http_client = HttpClient()
