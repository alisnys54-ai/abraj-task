#!/bin/sh
set -e

# Applies the current Prisma schema directly to the database. Using `db push`
# rather than `migrate deploy` here is a deliberate one-command-local-run /
# first-deployment choice: it needs no pre-existing migration history and is
# fully idempotent, so this works from a totally empty database on first run
# and on every run after. Switch to `migrate deploy` + a committed
# prisma/migrations folder once the schema stabilizes and versioned
# migrations are wanted.
#
# Retries below exist because on Railway/Render the database and app are
# separate services with no guaranteed startup ordering — the app container
# can easily start seconds before Postgres is actually accepting connections.
# A single failed attempt here must never be treated as final.

DB_MAX_ATTEMPTS=15
SEED_MAX_ATTEMPTS=8

echo "[entrypoint] Applying database schema..."
attempt=0
until npx prisma db push --skip-generate --accept-data-loss; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$DB_MAX_ATTEMPTS" ]; then
    echo "[entrypoint] Database still unreachable after $DB_MAX_ATTEMPTS attempts — aborting startup."
    exit 1
  fi
  echo "[entrypoint] Database not ready yet (attempt $attempt/$DB_MAX_ATTEMPTS) — retrying in 3s..."
  sleep 3
done

echo "[entrypoint] Seeding baseline data (idempotent — safe to run on every start, including the System Owner account)..."
attempt=0
until node dist/scripts/seed.js; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$SEED_MAX_ATTEMPTS" ]; then
    echo "[entrypoint] Seed failed after $SEED_MAX_ATTEMPTS attempts. Starting the API anyway so it can be inspected, but the System Owner account, roles, and permission catalog may be missing — check the logs above and consider redeploying."
    break
  fi
  echo "[entrypoint] Seed failed (attempt $attempt/$SEED_MAX_ATTEMPTS) — retrying in 3s..."
  sleep 3
done

echo "[entrypoint] Starting API..."
exec node dist/main
