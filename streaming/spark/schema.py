from pyspark.sql.types import (
    StringType,
    StructField,
    StructType,
    TimestampType,
    IntegerType,
    MapType,
)

log_schema = StructType(
    [
        StructField("service", StringType(), True),
        StructField("event", StringType(), True),
        StructField("operation", StringType(), True),
        StructField("endpoint", StringType(), True),
        StructField("method", StringType(), True),
        StructField("user_id", StringType(), True),
        StructField("order_id", StringType(), True),
        StructField("payment_id", StringType(), True),
        StructField("trace_id", StringType(), True),
        StructField("span_id", StringType(), True),
        StructField("parent_span_id", StringType(), True),
        StructField("correlation_id", StringType(), True),
        StructField("request_id", StringType(), True),
        StructField("status", StringType(), True),
        StructField("status_code", IntegerType(), True),
        StructField("response_time_ms", IntegerType(), True),
        StructField("ip_address", StringType(), True),
        StructField("hostname", StringType(), True),
        StructField("pod", StringType(), True),
        StructField("container", StringType(), True),
        StructField("user_agent", StringType(), True),
        StructField("headers", MapType(StringType(), StringType()), True),
        StructField("request_payload", StringType(), True),
        StructField("response_payload", StringType(), True),
        StructField("message", StringType(), True),
        StructField("timestamp", TimestampType(), True),
    ]
)
