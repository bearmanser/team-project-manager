FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    SQLITE_PATH=/data/db.sqlite3

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && mkdir -p /data

COPY . .

RUN chmod +x /app/entrypoint.sh

VOLUME ["/data"]

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]