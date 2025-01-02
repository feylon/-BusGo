#!/usr/bin/env bash
set -euo pipefail

PG_PORT=${TEST_PG_PORT:-55439}
REDIS_PORT=${TEST_REDIS_PORT:-56389}
PG=busline-test-pg
RD=busline-test-redis

cleanup() {
  docker rm -f "$PG" "$RD" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$PG" -e POSTGRES_USER=bus -e POSTGRES_PASSWORD=bus -e POSTGRES_DB=bus_test -p "127.0.0.1:${PG_PORT}:5432" postgres:16-alpine >/dev/null
docker run -d --name "$RD" -p "127.0.0.1:${REDIS_PORT}:6379" redis:7-alpine >/dev/null

until docker exec "$PG" pg_isready -U bus -d bus_test >/dev/null 2>&1; do sleep 1; done
sleep 2
docker exec "$PG" psql -U bus -d bus_test -qc "CREATE DATABASE bus_payment_test" >/dev/null

npm run build:packages >/dev/null

TEST_DATABASE_URL="postgres://bus:bus@127.0.0.1:${PG_PORT}/bus_test" \
TEST_REDIS_URL="redis://127.0.0.1:${REDIS_PORT}/1" \
  npm test -w @bus/api -- --verbose

TEST_PAYMENT_DATABASE_URL="postgres://bus:bus@127.0.0.1:${PG_PORT}/bus_payment_test" \
  npm test -w @bus/payment-service -- --verbose

npm test -w @bus/sms-service -- --verbose
