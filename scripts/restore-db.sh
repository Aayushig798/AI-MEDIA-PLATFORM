#!/usr/bin/env bash
# Replaces the live database with a pg_dump stored as a PRIVATE raw file in Cloudinary.
# Run on the EC2 box by .github/workflows/restore-db.yml (Actions tab -> "Restore
# database"). Make the dump with `npm run db:export` on the machine whose data you want.
#
#   bash scripts/restore-db.sh <cloudinary raw public_id>
#
# The current database is saved to ~/db-backups/ first, and put back automatically
# if the new dump fails to load. The download link is signed here with the
# Cloudinary keys from .env and never printed, so it doesn't show in the
# (public) Actions log.
set -euo pipefail
cd "$(dirname "$0")/.."

PUBLIC_ID="${1:?usage: restore-db.sh <cloudinary raw public_id>}"
[[ "$PUBLIC_ID" =~ ^[A-Za-z0-9/_.-]+$ ]] || { echo "invalid public_id: $PUBLIC_ID" >&2; exit 1; }

env_value() { sed -n "s/^$1=//p" .env | tr -d '"' | tail -1; }
sql() { docker compose exec -T db psql -U ecoevidence -d ecoevidence -v ON_ERROR_STOP=1 -tAc "$1"; }
counts() {
  sql "SELECT (SELECT count(*) FROM \"Project\") || ' projects, ' || (SELECT count(*) FROM \"MediaAsset\") || ' assets, '
    || (SELECT count(*) FROM \"LedgerEntry\") || ' ledger entries'"
}

CLOUD=$(env_value CLOUDINARY_CLOUD_NAME)
KEY=$(env_value CLOUDINARY_API_KEY)
SECRET=$(env_value CLOUDINARY_API_SECRET)
[ -n "$CLOUD" ] && [ -n "$KEY" ] && [ -n "$SECRET" ] || { echo "Cloudinary keys missing from .env" >&2; exit 1; }

# Cloudinary private download API: sha1 over the sorted params + secret
TS=$(date +%s)
EXPIRES=$((TS + 600))
SIG=$(printf '%s' "expires_at=$EXPIRES&public_id=$PUBLIC_ID&timestamp=$TS&type=private$SECRET" | openssl sha1 | awk '{print $NF}')

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
echo "Downloading $PUBLIC_ID..."
curl -fsS --get "https://api.cloudinary.com/v1_1/$CLOUD/raw/download" \
  --data-urlencode "expires_at=$EXPIRES" --data-urlencode "public_id=$PUBLIC_ID" \
  --data-urlencode "timestamp=$TS" --data-urlencode "type=private" \
  --data-urlencode "signature=$SIG" --data-urlencode "api_key=$KEY" \
  -o "$WORK/restore.dump"
echo "  $(du -h "$WORK/restore.dump" | cut -f1)"

docker compose up -d --wait db
docker compose cp "$WORK/restore.dump" db:/tmp/restore.dump
# Refuse anything that isn't a readable pg_dump before touching the live data
docker compose exec -T db pg_restore --list /tmp/restore.dump >/dev/null

echo "Current database: $(counts)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/db-backups}"
mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/before-restore-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db pg_dump -U ecoevidence -d ecoevidence -Fc -f /tmp/before.dump
docker compose cp db:/tmp/before.dump "$BACKUP"
echo "Backed up to $BACKUP"

load() {
  sql 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null
  docker compose exec -T db pg_restore -U ecoevidence -d ecoevidence --no-owner --no-acl --exit-on-error "$1"
}
if ! load /tmp/restore.dump; then
  echo "Restore failed; putting the previous database back" >&2
  load /tmp/before.dump
  docker compose restart app
  exit 1
fi
docker compose exec -T db rm -f /tmp/restore.dump /tmp/before.dump

# Schema in step with the deployed app, then restart so nothing cached survives
docker compose run --rm migrate
docker compose restart app
echo "Restored: $(counts)"
