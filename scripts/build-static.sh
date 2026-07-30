#!/usr/bin/env bash
# Hybrid static export: park API routes (Vercel-only) during Checkdomain export.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
umask 077
PARK="$(mktemp -d /tmp/dth-static-api-park.XXXXXX)"
cleanup() {
  if [[ -d "$PARK/api" ]]; then
    rm -rf "$ROOT/app/api"
    mv "$PARK/api" "$ROOT/app/api"
  fi
  rm -rf "$PARK"
}
trap cleanup EXIT

if [[ -d app/api ]]; then
  mv app/api "$PARK/api"
fi

export STATIC_EXPORT=1
next build
next-sitemap
if [[ -d out ]]; then
  # Best-effort permissions for Checkdomain upload (non-fatal in restricted envs)
  find out -type f -exec chmod 644 {} + 2>/dev/null || true
  find out -type d -exec chmod 755 {} + 2>/dev/null || true
  echo "STATIC_EXPORT_OK=YES"
else
  echo "STATIC_EXPORT_OK=NO"
  exit 1
fi
