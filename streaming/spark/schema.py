from pyspark.sql.types import StringType, StructField, StructType, TimestampType, IntegerType

log_schema = StructType(
    [
        StructField("service", StringType(), True),
        StructField("event", StringType(), True),
        StructField("endpoint", StringType(), True),
        StructField("method", StringType(), True),
        StructField("user_id", StringType(), True),
        StructField("status", StringType(), True),
        StructField("response_time_ms", IntegerType(), True),
        StructField("ip_address", StringType(), True),
        StructField("timestamp", TimestampType(), True),
    ]
)
