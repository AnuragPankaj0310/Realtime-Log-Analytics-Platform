from kafka import KafkaConsumer
import json


def test():
    consumer = KafkaConsumer(
        "application-logs",
        bootstrap_servers=["localhost:9092"],
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        value_deserializer=lambda x: json.loads(x.decode("utf-8")),
    )

    print("Reading from Kafka...")
    count = 0
    for message in consumer:
        msg = message.value
        if "request_id" in msg:
            print("Found request_id!")
            print(json.dumps(msg, indent=2))
            break
        count += 1
        if count % 1000 == 0:
            print(f"Read {count} messages...")


if __name__ == "__main__":
    test()
