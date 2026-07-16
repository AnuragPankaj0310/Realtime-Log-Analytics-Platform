import urllib.request
import json


def test():
    print("Testing /traces/recent...")
    try:
        req = urllib.request.Request("http://localhost:9200/raw-logs/_search")
        req.add_header("Content-Type", "application/json")
        data = json.dumps(
            {
                "query": {"match_all": {}},
                "sort": [{"timestamp": {"order": "desc"}}],
                "size": 1,
            }
        )
        with urllib.request.urlopen(req, data=data.encode("utf-8")) as r:
            res = json.loads(r.read().decode())
            print(f"Total hits: {res['hits']['total']['value']}")
            if res["hits"]["hits"]:
                print(
                    f"Sample: {json.dumps(res['hits']['hits'][0]['_source'], indent=2)}"
                )
    except Exception as e:
        print("ES error:", e)


if __name__ == "__main__":
    test()
