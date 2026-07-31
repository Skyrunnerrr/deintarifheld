#!/usr/bin/env bash
# Production static export for Checkdomain cutover (Phase B).
# Fail-closed without API origin. Does not wire LEADS_MAIL_MODE into the client.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
umask 077

EXPECTED_BRANCH_DEFAULT="feat/deintarifheld-production-cutover-001"
EVID_DIR="${DTH_09A_EVID:-/tmp/dth-09a-production-cutover-candidate}"
mkdir -p "$EVID_DIR"

BRANCH="$(git branch --show-current 2>/dev/null || true)"
SHA="$(git rev-parse HEAD)"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ -n "${DTH_REQUIRE_BRANCH:-}" && "$BRANCH" != "$DTH_REQUIRE_BRANCH" ]]; then
  echo "BUILD_ABORT reason=branch_mismatch expected=${DTH_REQUIRE_BRANCH} actual=${BRANCH:-detached}"
  exit 2
fi

ORIGIN_RAW="${NEXT_PUBLIC_LEADS_API_ORIGIN:-}"
URL_RAW="${NEXT_PUBLIC_LEADS_API_URL:-}"

if [[ -z "$ORIGIN_RAW" && -z "$URL_RAW" ]]; then
  echo "BUILD_ABORT reason=missing_api_env need=NEXT_PUBLIC_LEADS_API_ORIGIN_or_NEXT_PUBLIC_LEADS_API_URL"
  exit 3
fi

# Normalize to origin (no trailing slash, no /api/leads)
if [[ -n "$ORIGIN_RAW" ]]; then
  API_ORIGIN="${ORIGIN_RAW%/}"
else
  API_ORIGIN="$(printf '%s' "$URL_RAW" | sed -E 's#/api/leads/?$##; s#/$##')"
fi

if [[ ! "$API_ORIGIN" =~ ^https://[A-Za-z0-9._-]+ ]]; then
  echo "BUILD_ABORT reason=invalid_api_origin value_redacted"
  exit 4
fi

export NEXT_PUBLIC_LEADS_API_ORIGIN="$API_ORIGIN"
# Keep legacy var aligned to full trailing-slash endpoint for older helpers
export NEXT_PUBLIC_LEADS_API_URL="${API_ORIGIN}/api/leads/"

echo "STATIC_PRODUCTION_BUILD_START branch=${BRANCH:-detached} sha=$SHA origin=$API_ORIGIN"

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
rm -rf .next out
npx next build
npx next-sitemap

if [[ ! -d out ]]; then
  echo "STATIC_EXPORT_OK=NO"
  exit 1
fi

find out -type f -exec chmod 644 {} + 2>/dev/null || true
find out -type d -exec chmod 755 {} + 2>/dev/null || true

META_DIR="out/.dth-build"
mkdir -p "$META_DIR"
MAIL_GATE="${LEADS_MAIL_MODE:-mock}"
# Never embed secrets — mail mode is an operational gate label only
cat > "$META_DIR/build-metadata.json" <<EOF
{
  "gitCommitSha": "$SHA",
  "gitBranch": "${BRANCH:-detached}",
  "buildTimestamp": "$TS",
  "apiOrigin": "$API_ORIGIN",
  "phase": "B",
  "mailOperationalGate": "$MAIL_GATE",
  "staticExport": true,
  "hostingTarget": "checkdomain"
}
EOF

# Convenience copy for evidence
cp "$META_DIR/build-metadata.json" "$EVID_DIR/build-metadata.json" 2>/dev/null || true

echo "STATIC_EXPORT_OK=YES"
echo "API_ORIGIN=$API_ORIGIN"
echo "BUILD_METADATA=$META_DIR/build-metadata.json"
