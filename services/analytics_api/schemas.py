from pydantic import BaseModel


class AnalyticsResponse(BaseModel):
    status: str
    metric: str
