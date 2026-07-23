FROM apache/spark:3.5.3

USER root

ENV PATH="/opt/spark/bin:${PATH}"

RUN mkdir -p /home/spark/.ivy2/cache \
    && mkdir -p /home/spark/.ivy2/jars \
    && chown -R spark:spark /home/spark/.ivy2 \
    && mkdir -p /data/checkpoints \
    && chown -R spark:spark /data

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

USER spark

CMD ["spark-submit","--packages","org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.3","/app/stream_processor.py"]