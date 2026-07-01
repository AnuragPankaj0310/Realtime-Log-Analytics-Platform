from pyspark.sql import SparkSession
from pyspark.sql import functions as F

from streaming.spark.config import settings
from streaming.spark.elastic import write_to_elasticsearch
from streaming.spark.schema import log_schema


def start_streaming():
    spark = SparkSession.builder.appName("log-analytics").getOrCreate()

    df = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", settings.kafka_bootstrap_servers)
        .option("subscribe", settings.kafka_topic)
        .option("startingOffsets", "latest")
        .load()
    )

    parsed = df.selectExpr("CAST(value AS STRING) as payload").select(F.from_json(F.col("payload"), log_schema).alias("event"))
    parsed = parsed.select("event.*")

    aggregated = (
        parsed.groupBy(F.window(F.col("timestamp"), "1 minute"), F.col("service"))
        .agg(
            F.count("*").alias("request_count"),
            F.avg("response_time_ms").alias("average_latency"),
            F.avg(F.when(F.col("status").cast("int") >= 400, 1).otherwise(0)).alias("error_rate"),
        )
        .withColumn("requests_per_minute", F.col("request_count"))
    )

    query = (
        aggregated.writeStream.format("console")
        .outputMode("complete")
        .option("checkpointLocation", settings.checkpoint_location)
        .start()
    )

    query.awaitTermination()


def main():
    start_streaming()
