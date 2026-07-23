FROM python:3.11.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Parent directory is the working dir so `analytics_api` is importable as a package
WORKDIR /svc

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy service files into the package directory
COPY . ./analytics_api/

EXPOSE 8000

CMD ["uvicorn", "analytics_api.main:app", "--host", "0.0.0.0", "--port", "8000"]