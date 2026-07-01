class ElasticsearchClient:
    def __init__(self, host: str = "http://elasticsearch:9200"):
        self.host = host

    def ping(self) -> bool:
        return True
