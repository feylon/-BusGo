#!/bin/sh
set -e
node dist/database/migrate.js
if [ "${SEED_ON_START:-true}" = "true" ]; then
  node dist/database/seed.js
fi
exec node dist/main.js
