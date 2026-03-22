#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn --bind 0.0.0.0:${PORT:-8000} --worker-class uvicorn.workers.UvicornWorker config.asgi:application