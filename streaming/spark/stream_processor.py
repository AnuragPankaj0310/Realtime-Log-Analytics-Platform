from pyspark.sql import SparkSession
from pyspark.sql import functions as F

from config import settings
from elastic import write_to_elasticsearch
from schema import log_schema


def start_streaming():
    spark = (
        SparkSession.builder
        .appName("log-analytics")
        .getOrCreate()
    )

    df = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", settings.kafka_bootstrap_servers)
        .option("subscribe", settings.kafka_topic)
        .option("startingOffsets", "earliest")
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
        aggregated.writeStream
        .outputMode("complete")
        .foreachBatch(
            lambda df, epoch: write_to_elasticsearch(df, "log-analytics")
        )
        .option("checkpointLocation", settings.checkpoint_location)
        .start()
    )

    query.awaitTermination()


def main():
    start_streaming()

if __name__ == "__main__":
    main()