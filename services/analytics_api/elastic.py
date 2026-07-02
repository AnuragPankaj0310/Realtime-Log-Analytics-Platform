from elasticsearch import Elasticsearch

es = Elasticsearch("http://elasticsearch:9200")

INDEX = "log-analytics"