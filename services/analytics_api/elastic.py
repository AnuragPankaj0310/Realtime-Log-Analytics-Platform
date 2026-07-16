from elasticsearch import Elasticsearch

from .config import settings

es = Elasticsearch(settings.elasticsearch_host)
INDEX = settings.elasticsearch_index