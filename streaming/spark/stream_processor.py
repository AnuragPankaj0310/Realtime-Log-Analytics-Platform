from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType

from config import settings
from elastic import write_to_elasticsearch
from schema import log_schema

import threading
import time
from datetime import datetime
import os
from elasticsearch import Elasticsearch


def metric_reporter(spark):
    client = Elasticsearch(
        hosts=[os.getenv("ELASTICSEARCH_HOST", "http://elasticsearch:9200")],
        timeout=30,
    )
    if not client.indices.exists(index="spark-metrics"):
        client.indices.create(index="spark-metrics", ignore=400)

    while True:
        try:
            for stream in spark.streams.active:
                progress = stream.lastProgress
                if progress:
                    payload = {
                        "timestamp": datetime.utcnow(),
                        "name": stream.name,
                        "inputRowsPerSecond": progress.get("inputRowsPerSecond", 0),
                        "processedRowsPerSecond": progress.get(
                            "processedRowsPerSecond", 0
                        ),
                        "numInputRows": progress.get("numInputRows", 0),
                    }
                    client.index(index="spark-metrics", document=payload)
        except Exception as e:
            print("Metric reporter error", e)
        time.sleep(5)


def start_streaming():
    spark = SparkSession.builder.appName("log-analytics").getOrCreate()

    df = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", settings.kafka_bootstrap_servers)
        .option("subscribe", settings.kafka_topic)
        .option("startingOffsets", "earliest")
        .load()
    )

    parsed = df.selectExpr("CAST(value AS STRING) as payload").select(
        F.from_json(F.col("payload"), log_schema).alias("event")
    )
    parsed = parsed.select("event.*")

    # Cast status_code correctly
    parsed = parsed.withColumn("status_code", F.col("status_code").cast(IntegerType()))

    # 1. Service Metrics Aggregation (10 second windows)
    service_agg = (
        parsed.withWatermark("timestamp", "30 seconds")
        .groupBy(F.window(F.col("timestamp"), "10 seconds"), F.col("service"))
        .agg(
            F.count("*").alias("requests"),
            F.avg("response_time_ms").alias("avg_latency"),
            F.expr("percentile_approx(response_time_ms, 0.5)").alias("p50"),
            F.expr("percentile_approx(response_time_ms, 0.90)").alias("p90"),
            F.expr("percentile_approx(response_time_ms, 0.95)").alias("p95"),
            F.expr("percentile_approx(response_time_ms, 0.99)").alias("p99"),
            F.sum(F.when(F.col("status_code") >= 400, 1).otherwise(0)).alias("errors"),
            F.sum(F.when(F.col("status_code") == 200, 1).otherwise(0)).alias(
                "status_200"
            ),
            F.sum(F.when(F.col("status_code") == 404, 1).otherwise(0)).alias(
                "status_404"
            ),
            F.sum(F.when(F.col("status_code") == 500, 1).otherwise(0)).alias(
                "status_500"
            ),
        )
        .withColumn("error_rate", F.col("errors") / F.col("requests"))
        .withColumn("availability", 100.0 - (F.col("error_rate") * 100))
        .withColumn("requests_per_sec", F.col("requests") / 10.0)
        .withColumn("timestamp", F.col("window.end"))
    )

    # 2. Endpoint Metrics Aggregation
    endpoint_agg = (
        parsed.withWatermark("timestamp", "30 seconds")
        .groupBy(
            F.window(F.col("timestamp"), "10 seconds"),
            F.col("service"),
            F.col("endpoint"),
        )
        .agg(
            F.count("*").alias("requests"),
            F.avg("response_time_ms").alias("avg_latency"),
            F.expr("percentile_approx(response_time_ms, 0.95)").alias("p95"),
            F.sum(F.when(F.col("status_code") >= 400, 1).otherwise(0)).alias("errors"),
        )
        .withColumn("error_rate", F.col("errors") / F.col("requests"))
        .withColumn("timestamp", F.col("window.end"))
    )

    # 3. Global Metrics Aggregation (10 second windows)
    global_agg = (
        parsed.withWatermark("timestamp", "30 seconds")
        .groupBy(F.window(F.col("timestamp"), "10 seconds"))
        .agg(
            F.count("*").alias("requests"),
            F.avg("response_time_ms").alias("avg_latency"),
            F.expr("percentile_approx(response_time_ms, 0.5)").alias("p50"),
            F.expr("percentile_approx(response_time_ms, 0.90)").alias("p90"),
            F.expr("percentile_approx(response_time_ms, 0.95)").alias("p95"),
            F.expr("percentile_approx(response_time_ms, 0.99)").alias("p99"),
            F.sum(F.when(F.col("status_code") >= 400, 1).otherwise(0)).alias("errors"),
            F.sum(F.when(F.col("status_code") == 200, 1).otherwise(0)).alias(
                "status_200"
            ),
            F.sum(F.when(F.col("status_code") == 404, 1).otherwise(0)).alias(
                "status_404"
            ),
            F.sum(F.when(F.col("status_code") == 500, 1).otherwise(0)).alias(
                "status_500"
            ),
            F.sum(F.when(F.col("response_time_ms") <= 50, 1).otherwise(0)).alias(
                "latency_0_50"
            ),
            F.sum(
                F.when(
                    (F.col("response_time_ms") > 50)
                    & (F.col("response_time_ms") <= 100),
                    1,
                ).otherwise(0)
            ).alias("latency_50_100"),
            F.sum(
                F.when(
                    (F.col("response_time_ms") > 100)
                    & (F.col("response_time_ms") <= 200),
                    1,
                ).otherwise(0)
            ).alias("latency_100_200"),
            F.sum(
                F.when(
                    (F.col("response_time_ms") > 200)
                    & (F.col("response_time_ms") <= 500),
                    1,
                ).otherwise(0)
            ).alias("latency_200_500"),
            F.sum(
                F.when(
                    (F.col("response_time_ms") > 500)
                    & (F.col("response_time_ms") <= 1000),
                    1,
                ).otherwise(0)
            ).alias("latency_500_1000"),
            F.sum(F.when(F.col("response_time_ms") > 1000, 1).otherwise(0)).alias(
                "latency_1000_plus"
            ),
        )
        .withColumn("error_rate", F.col("errors") / F.col("requests"))
        .withColumn("availability", 100.0 - (F.col("error_rate") * 100))
        .withColumn("requests_per_sec", F.col("requests") / 10.0)
        .withColumn("timestamp", F.col("window.end"))
    )

    (
        service_agg.writeStream.queryName("service-metrics")
        .outputMode("append")
        .foreachBatch(lambda df, epoch: write_to_elasticsearch(df, "service-metrics"))
        .option("checkpointLocation", settings.checkpoint_location + "_service")
        .start()
    )

    (
        endpoint_agg.writeStream.queryName("endpoint-metrics")
        .outputMode("append")
        .foreachBatch(lambda df, epoch: write_to_elasticsearch(df, "endpoint-metrics"))
        .option("checkpointLocation", settings.checkpoint_location + "_endpoint")
        .start()
    )

    (
        global_agg.writeStream.queryName("global-metrics")
        .outputMode("append")
        .foreachBatch(lambda df, epoch: write_to_elasticsearch(df, "global-metrics"))
        .option("checkpointLocation", settings.checkpoint_location + "_global")
        .start()
    )

    (
        parsed.writeStream.queryName("raw-logs")
        .outputMode("append")
        .foreachBatch(lambda df, epoch: write_to_elasticsearch(df, "raw-logs"))
        .option("checkpointLocation", settings.checkpoint_location + "_raw")
        .start()
    )

    reporter_thread = threading.Thread(
        target=metric_reporter, args=(spark,), daemon=True
    )
    reporter_thread.start()

    spark.streams.awaitAnyTermination()


def main():
    start_streaming()


if __name__ == "__main__":
    main()
