#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

export SUPABASE_DB_PASSWORD="$(node -e "require('dotenv').config({path:'.env.local', quiet: true}); process.stdout.write(process.env.SUPABASE_DB_PASSWORD || '')")"
if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "SUPABASE_DB_PASSWORD no encontrada en .env.local"
  exit 1
fi

PROJECT_REF="ayszrtieplmqscqtabsu"
DB_URL="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-us-east-2.pooler.supabase.com:5432/postgres"

redact() {
  node -e "
    const fs = require('fs');
    const pw = process.env.SUPABASE_DB_PASSWORD;
    const text = fs.readFileSync(0, 'utf8');
    process.stdout.write(text.split(pw).join('***REDACTED***'));
  "
}

echo "== 1/2: supabase db pull (linea base del esquema real) =="
npx --yes supabase db pull baseline_2026_08_28 --db-url "$DB_URL" --schema public --yes --debug > /tmp/db_pull_raw.log 2>&1 || true
redact < /tmp/db_pull_raw.log
rm -f /tmp/db_pull_raw.log

echo ""
echo "== 2/2: supabase db dump (backup real, schema + datos) =="
mkdir -p backups
npx --yes supabase db dump --db-url "$DB_URL" -f backups/pg_dump_2026_08_28.sql --debug > /tmp/db_dump_raw.log 2>&1 || true
redact < /tmp/db_dump_raw.log
rm -f /tmp/db_dump_raw.log

echo ""
echo "Listo. Migracion nueva en supabase/migrations/ (si el pull funciono), backup en backups/pg_dump_2026_08_28.sql (si el dump funciono)"
