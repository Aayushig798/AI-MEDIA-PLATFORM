#!/usr/bin/env bash
# Deploys on the EC2 box: builds the image, then runs the app and its Postgres together
# with Docker Compose (docker-compose.yml). deploy.yml runs this on every push to main.
#
# The first deploy on a box also copies the existing Neon database into the new, empty
# local Postgres before the app switches over. Neon itself is never modified, so it
# stays as a backup.
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! docker compose version >/dev/null 2>&1; then
  echo "Installing the Docker Compose plugin..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-compose-v2 || sudo apt-get install -y -qq docker-compose-plugin
fi

# Generated once: Postgres only reads it when its data volume is first created
if ! grep -q '^POSTGRES_PASSWORD=' .env; then
  echo "POSTGRES_PASSWORD=\"$(openssl rand -hex 24)\"" >> .env
fi

env_value() { sed -n "s/^$1=//p" .env | tr -d '"' | tail -1; }
local_sql() { docker compose exec -T db psql -U ecoevidence -d ecoevidence -tAc "$1"; }
disk_free() { df -h / | awk 'NR==2 {print $4 " free of " $2}'; }

# Every build starts from scratch (--no-cache), so Docker's build cache is dead weight,
# and 2-3 GB of it piled up per deploy until the disk filled and a build failed.
# Clear it and dangling images first; running containers and their images are untouched.
echo "Disk before cleanup: $(disk_free)"
docker builder prune -af >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
echo "Disk after cleanup:  $(disk_free)"

docker compose build --no-cache app
docker compose up -d --wait db

# One-time copy from Neon, only ever into an empty database
SRC=$(env_value NEON_DATABASE_URL)
[ -n "$SRC" ] || SRC=$(env_value DATABASE_URL)
if [ "$(local_sql "SELECT to_regclass('public.\"Project\"') IS NULL")" = "t" ] \
  && [[ "$SRC" == postgres* && "$SRC" != *@db:* ]]; then
  echo "Local database is empty: copying the Neon database into it..."
  # Warnings about Neon-only roles/objects are expected; the row counts below decide success
  docker compose exec -T -e SRC="$SRC" db sh -c \
    'pg_dump "$SRC" -Fc --no-owner --no-acl | pg_restore --no-owner --no-acl -U ecoevidence -d ecoevidence' || true

  ok=1
  for t in User Project MediaAsset AssetIntegrity Comparison LedgerEntry MediaEmbedding; do
    a=$(docker compose exec -T db psql "$SRC" -tAc "SELECT count(*) FROM public.\"$t\"" || echo error)
    b=$(local_sql "SELECT count(*) FROM public.\"$t\"" 2>/dev/null || echo missing)
    printf '  %-16s neon=%-6s local=%s\n' "$t" "$a" "$b"
    [ "$a" = "$b" ] || ok=0
  done
  if [ "$ok" != 1 ]; then
    # Empty it again so the next deploy retries the copy instead of going live half-filled
    local_sql 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null
    echo "Copy from Neon didn't match; the old app is still running. Fix and redeploy." >&2
    exit 1
  fi
fi

# Set up / update the schema before touching the running app
docker compose run --rm migrate

# Replace the pre-Compose container (started with plain `docker run`) if it's still around
docker rm -f ai-media-platform >/dev/null 2>&1 || true
docker compose up -d --remove-orphans

# The previous app image (now untagged) and this build's cache are no longer needed
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -af >/dev/null 2>&1 || true
echo "Disk after deploy:   $(disk_free)"
