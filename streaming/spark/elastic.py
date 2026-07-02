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
        actions.append({"index": {"_index": index_name}})
        actions.append(payload)

    if actions:
        actions = [
        {
            "_index": index_name,
            "_source": row.asDict(recursive=True)
        }
        for row in rows
    ]

    bulk(client, actions)
