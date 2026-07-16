import hashlib
import json
import os

from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk


def write_to_elasticsearch(df, index_name: str):
    if df.rdd.isEmpty():
        return

    client = Elasticsearch(
        hosts=[os.getenv("ELASTICSEARCH_HOST", "http://elasticsearch:9200")],
        timeout=30,
    )

    if not client.indices.exists(index=index_name):
        client.indices.create(index=index_name, ignore=400)

    rows = df.collect()
    actions = []
    for row in rows:
        payload = row.asDict(recursive=True)
        payload_id = hashlib.sha256(
            json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()
        actions.append(
            {
                "_index": index_name,
                "_id": payload_id,
                "_op_type": "index",
                "_source": payload,
            }
        )

    if actions:
        bulk(client, actions)
