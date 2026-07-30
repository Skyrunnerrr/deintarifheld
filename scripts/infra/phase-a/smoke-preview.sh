#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
load_config_if_present

PREVIEW_URL="${PREVIEW_URL:-${LEADS_API_BASE:-}}"
[[ -n "$PREVIEW_URL" ]] || {
  log "PREVIEW_URL or LEADS_API_BASE required"
  exit_token PREVIEW_DEPLOYMENT_FAILED
}
BASE="${PREVIEW_URL%/}"
[[ "$BASE" == */api/leads ]] || BASE="${BASE}/api/leads"
API_ROOT="${BASE%/api/leads}"

MARKER="DTH-PHASE-A-SMOKE-$(date -u +%Y%m%d-%H%M%S)"
EMAIL="${CONTROLLED_TEST_EMAIL:-}"
[[ -n "$EMAIL" ]] || exit_token CONTROLLED_TEST_RECIPIENT_REQUIRED
IDEM="smoke-${MARKER}"

log "HEALTH_CHECK"
curl -sS "$API_ROOT/api/leads" | redact | tee "$STATUS_DIR/smoke-health.json"

log "UNAUTH_RETENTION"
CODE_R=$(curl -sS -o "$STATUS_DIR/smoke-retention-unauth.json" -w '%{http_code}' "$API_ROOT/api/cron/retention" || true)
log "UNAUTH_RETENTION_HTTP=$CODE_R"

log "UNAUTH_DELETE"
CODE_D=$(curl -sS -o "$STATUS_DIR/smoke-delete-unauth.json" -w '%{http_code}' \
  -X POST "$API_ROOT/api/admin/leads/delete" -H 'content-type: application/json' -d '{"email":"x@example.com"}' || true)
log "UNAUTH_DELETE_HTTP=$CODE_D"

PAYLOAD=$(jq -n \
  --arg m "$MARKER" \
  --arg e "$EMAIL" \
  '{
    page_source:"unternehmen",
    firma:("DTH PHASE A SMOKE "+$m),
    ansprechpartner:"Max Mustermann",
    email:$e,
    telefon:"0000000000",
    plz:"69115",
    energieart:"strom",
    standorte:"1",
    nachricht:"Automatisierter Phase-A-Smoke-Test. Kein echter Kunde.",
    dsgvo:true,
    form_version:"2.0",
    source_page:"/unternehmen-neu/",
    _formLoadedAt:(now*1000|floor-5000),
    website_url:"",
    company_fax:""
  }')

HTTP=$(curl -sS -o "$STATUS_DIR/smoke-submit.json" -w '%{http_code}' \
  -X POST "$API_ROOT/api/leads" \
  -H 'content-type: application/json' \
  -H "origin: http://localhost:3000" \
  -H "idempotency-key: $IDEM" \
  -d "$PAYLOAD")
log "SMOKE_HTTP=$HTTP"
jq '{ok,leadRef,mail,code,duplicate,idempotent}' "$STATUS_DIR/smoke-submit.json" 2>/dev/null | redact || true

HTTP2=$(curl -sS -o "$STATUS_DIR/smoke-submit-idem.json" -w '%{http_code}' \
  -X POST "$API_ROOT/api/leads" \
  -H 'content-type: application/json' \
  -H "origin: http://localhost:3000" \
  -H "idempotency-key: $IDEM" \
  -d "$PAYLOAD")
log "IDEM_HTTP=$HTTP2"
jq '{ok,duplicate,idempotent,leadRef}' "$STATUS_DIR/smoke-submit-idem.json" 2>/dev/null | redact || true

if [[ -n "${LEADS_ADMIN_SECRET-}" ]]; then
  curl -sS -X POST "$API_ROOT/api/admin/leads/delete" \
    -H "authorization: Bearer ${LEADS_ADMIN_SECRET}" \
    -H 'content-type: application/json' \
    -d "$(jq -n --arg e "$EMAIL" '{email:$e}')" \
    | redact | tee "$STATUS_DIR/smoke-delete.json"
fi

write_status smoke "{\"marker\":\"$MARKER\",\"http\":$HTTP,\"idem_http\":$HTTP2}"
log "SMOKE_SCRIPT_COMPLETE"
