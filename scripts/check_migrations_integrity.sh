#!/usr/bin/env bash
# Verify every migration folder under packages/db/prisma/migrations/ has migration.sql.
# Prisma requires each migration directory to contain migration.sql; missing files cause P3015.
# Usage: ./scripts/check_migrations_integrity.sh   or   pnpm verify:db

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../packages/db/prisma/migrations" && pwd)"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "FAIL: migrations dir not found: $MIGRATIONS_DIR"
  exit 1
fi

FAILED=0
shopt -s nullglob 2>/dev/null || true
for dir in "$MIGRATIONS_DIR"/*/; do
  dirname=$(basename "$dir")
  if [ ! -f "${dir}migration.sql" ]; then
    echo "FAIL: migration folder missing migration.sql: $dirname"
    FAILED=1
  fi
done

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "Fix: ensure every folder under packages/db/prisma/migrations/ contains migration.sql"
  echo "Then run: pnpm --filter @crowdvest/db migrate:deploy"
  exit 1
fi

echo "OK: all migration folders have migration.sql"
