#!/usr/bin/env bash
# Full non-production preview E2E for every public DTH form entry point.
# Requires the dedicated smoke bypass and admin secret. Never targets production.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
load_config_if_present

require_cmd curl
require_cmd jq

PREVIEW_URL="${PREVIEW_URL:-${LEADS_API_BASE:-}}"
[[ -n "$PREVIEW_URL" ]] || {
  log "PREVIEW_URL or LEADS_API_BASE required"
  exit_token PREVIEW_DEPLOYMENT_FAILED
}
API_ROOT="${PREVIEW_URL%/}"
API_ROOT="${API_ROOT%/api/leads}"
API_ROOT="${API_ROOT%/api/leads/}"

case "$API_ROOT" in
  https://deintarifheld-leads-api.vercel.app|https://www.deintarifheld.de|https://deintarifheld.de)
    log "REFUSE_PRODUCTION_TARGET=YES"
    exit_token PREVIEW_PRODUCTION_TARGET_FORBIDDEN
    ;;
esac

SMOKE_SECRET="${LEADS_INTAKE_SMOKE_SECRET:-}"
[[ ${#SMOKE_SECRET} -ge 16 ]] || {
  log "LEADS_INTAKE_SMOKE_SECRET required (>=16 chars)"
  exit_token PREVIEW_SMOKE_SECRET_REQUIRED
}

ADMIN_SECRET="${LEADS_ADMIN_SECRET:-}"
[[ -n "$ADMIN_SECRET" ]] || {
  log "LEADS_ADMIN_SECRET required for storage proof and cleanup"
  exit_token PREVIEW_ADMIN_SECRET_REQUIRED
}

EMAIL="${CONTROLLED_TEST_EMAIL:-}"
[[ "$EMAIL" == *@* ]] || {
  log "CONTROLLED_TEST_EMAIL required"
  exit_token CONTROLLED_TEST_RECIPIENT_REQUIRED
}

MARKER="DTH-PREVIEW-E2E-$(date -u +%Y%m%d-%H%M%S)-$RANDOM"
UA="dth-preview-e2e/1"
COMMON_HEADERS=(
  -H 'content-type: application/json'
  -H "x-dth-intake-smoke: $SMOKE_SECRET"
  -H "user-agent: $UA"
)

log "PREVIEW_E2E_START marker=$MARKER"

health_check() {
  local path="$1" name="$2" output="$STATUS_DIR/health-$name.json" http
  http="$(curl -sS -o "$output" -w '%{http_code}' --max-time 20 "$API_ROOT$path")"
  [[ "$http" == "200" ]] || {
    log "HEALTH_FAIL name=$name http=$http"
    return 1
  }
  jq -e '.ok == true' "$output" >/dev/null || {
    log "HEALTH_FAIL name=$name body_ok=NO"
    return 1
  }
  log "HEALTH_PASS name=$name"
}

expect_http() {
  local expected="$1" actual="$2" label="$3"
  [[ "$actual" == "$expected" ]] || {
    log "HTTP_ASSERT_FAIL label=$label expected=$expected actual=$actual"
    return 1
  }
}

submit_case() {
  local name="$1" endpoint="$2" payload="$3"
  local idem="smoke-$MARKER-$name"
  local first="$STATUS_DIR/form-$name-first.json"
  local second="$STATUS_DIR/form-$name-idem.json"
  local http1 http2 ref1 ref2

  http1="$(curl -sS -o "$first" -w '%{http_code}' --max-time 25     -X POST "$API_ROOT$endpoint"     "${COMMON_HEADERS[@]}"     -H "idempotency-key: $idem"     -d "$payload")"

  [[ "$http1" == "200" || "$http1" == "202" ]] || {
    log "FORM_FAIL name=$name stage=first http=$http1 code=$(jq -r '.code // "unknown"' "$first" 2>/dev/null || true)"
    return 1
  }
  jq -e '.ok == true and (.duplicate == false) and (.idempotent == false) and (.leadRef | type == "string")' "$first" >/dev/null || {
    log "FORM_FAIL name=$name stage=first contract=NO"
    return 1
  }
  ref1="$(jq -r '.leadRef' "$first")"

  http2="$(curl -sS -o "$second" -w '%{http_code}' --max-time 25     -X POST "$API_ROOT$endpoint"     "${COMMON_HEADERS[@]}"     -H "idempotency-key: $idem"     -d "$payload")"

  expect_http 200 "$http2" "$name-idempotent"
  jq -e '.ok == true and (.duplicate == true) and (.idempotent == true) and (.leadRef | type == "string")' "$second" >/dev/null || {
    log "FORM_FAIL name=$name stage=idempotent contract=NO"
    return 1
  }
  ref2="$(jq -r '.leadRef' "$second")"
  [[ "$ref1" == "$ref2" ]] || {
    log "FORM_FAIL name=$name stage=idempotent ref_mismatch=YES"
    return 1
  }

  printf '%s\n' "$ref1" >> "$STATUS_DIR/form-refs.txt"
  log "FORM_PASS name=$name first_http=$http1 duplicate_http=$http2"
}

health_check "/api/leads/" "leads"
health_check "/api/careers/" "careers"

# Security: protected operations must reject unauthenticated callers.
unauth_admin="$(curl -sS -o "$STATUS_DIR/admin-unauth.json" -w '%{http_code}' --max-time 20 "$API_ROOT/api/admin/leads/")"
expect_http 401 "$unauth_admin" "admin-unauth"

unauth_delete="$(curl -sS -o "$STATUS_DIR/delete-unauth.json" -w '%{http_code}' --max-time 20   -X POST "$API_ROOT/api/admin/leads/delete/"   -H 'content-type: application/json'   -d '{"email":"x@example.invalid","mode":"physical","channel":"all"}')"
expect_http 401 "$unauth_delete" "delete-unauth"

unauth_retention="$(curl -sS -o "$STATUS_DIR/retention-unauth.json" -w '%{http_code}' --max-time 20 "$API_ROOT/api/cron/retention/")"
expect_http 401 "$unauth_retention" "retention-unauth"
log "UNAUTH_GATES=PASS"

hero_payload="$(jq -nc   --arg e "$EMAIL" --arg m "$MARKER"   '{page_source:"hero-funnel",lead_type:"private_energy",firstName:("Hero "+$m),email:$e,phone:"015112345678",provider:"TestVersorger",usage:"3500",zip:"69115",type:"strom",gdpr:true,form_version:"2.0",source_page:"/",_formLoadedAt:1,website_url:"",company_fax:""}')"

funnel_payload="$(jq -nc   --arg e "$EMAIL" --arg m "$MARKER"   '{page_source:"main_funnel",lead_type:"private_energy",firstName:("Funnel "+$m),email:$e,phone:"015112345678",provider:"TestVersorger",usage:"4200",consumption:"4200",zip:"69115",type:"gas",gdpr:true,form_version:"2.0",source_page:"/",_formLoadedAt:1,website_url:"",company_fax:""}')"

business_live_payload="$(jq -nc   --arg e "$EMAIL" --arg m "$MARKER"   '{page_source:"unternehmen",lead_type:"business_energy",firma:("DTH Live "+$m),ansprechpartner:"Smoke Tester",email:$e,telefon:"015112345678",plz:"69115",energieart:"Strom",verbrauchStrom:"50000",verbrauchGas:"",standorte:"1",versorger:"TestVersorger",vertragslaufzeit:"ja",nachricht:"Controlled preview smoke",dsgvo:true,form_version:"2.0",source_page:"/unternehmen/",_formLoadedAt:1,website_url:"",company_fax:""}')"

business_preview_payload="$(jq -nc   --arg e "$EMAIL" --arg m "$MARKER"   '{page_source:"unternehmen",lead_type:"business_energy",firma:("DTH Preview "+$m),ansprechpartner:"Smoke Tester",email:$e,telefon:"015112345678",plz:"69115",energieart:"Gas",verbrauchStrom:"",verbrauchGas:"90000",standorte:"2–5",versorger:"TestVersorger",vertragslaufzeit:"ja",nachricht:"Controlled preview smoke",dsgvo:true,form_version:"2.0",source_page:"/unternehmen-neu/",_formLoadedAt:1,website_url:"",company_fax:""}')"

career_home_payload="$(jq -nc   --arg e "$EMAIL" --arg m "$MARKER"   '{page_source:"career",name:("Partner Home "+$m),email:$e,phone:"015112345678",motivation:"Controlled partner inquiry smoke with sufficient text.",gdpr:true,form_version:"2.0",source_page:"/",_formLoadedAt:1,website_url:"",company_fax:""}')"

career_route_payload="$(jq -nc   --arg e "$EMAIL" --arg m "$MARKER"   '{page_source:"career",name:("Partner Route "+$m),email:$e,phone:"015112345678",motivation:"Controlled partner inquiry smoke with sufficient text.",gdpr:true,form_version:"2.0",source_page:"/karriere/",_formLoadedAt:1,website_url:"",company_fax:""}')"

submit_case "hero" "/api/leads/" "$hero_payload"
submit_case "main-funnel" "/api/leads/" "$funnel_payload"
submit_case "business-live" "/api/leads/" "$business_live_payload"
submit_case "business-preview" "/api/leads/" "$business_preview_payload"
submit_case "career-home" "/api/careers/" "$career_home_payload"
submit_case "career-route" "/api/careers/" "$career_route_payload"

# Honeypot must fail closed at both intake routes and must not create a row.
bot_lead="$(jq -nc --arg e "$EMAIL" '{page_source:"hero-funnel",firstName:"Bot",email:$e,phone:"015112345678",provider:"X",usage:"1",zip:"69115",type:"strom",gdpr:true,website_url:"bot.example",company_fax:""}')"
bot_http="$(curl -sS -o "$STATUS_DIR/honeypot-leads.json" -w '%{http_code}' --max-time 20   -X POST "$API_ROOT/api/leads/" "${COMMON_HEADERS[@]}" -H "idempotency-key: bot-$MARKER-lead" -d "$bot_lead")"
expect_http 403 "$bot_http" "honeypot-leads"
jq -e '.ok == false and .code == "request-blocked"' "$STATUS_DIR/honeypot-leads.json" >/dev/null

bot_career="$(jq -nc --arg e "$EMAIL" '{page_source:"career",name:"Bot Test",email:$e,phone:"015112345678",motivation:"This is a sufficiently long bot message.",gdpr:true,website_url:"bot.example",company_fax:""}')"
bot_career_http="$(curl -sS -o "$STATUS_DIR/honeypot-careers.json" -w '%{http_code}' --max-time 20   -X POST "$API_ROOT/api/careers/" "${COMMON_HEADERS[@]}" -H "idempotency-key: bot-$MARKER-career" -d "$bot_career")"
expect_http 403 "$bot_career_http" "honeypot-careers"
jq -e '.ok == false and .code == "request-blocked"' "$STATUS_DIR/honeypot-careers.json" >/dev/null
log "HONEYPOT_E2E=PASS"

# Verify all first-submit refs are actually visible in the authenticated ops inbox.
admin_http="$(curl -sS -o "$STATUS_DIR/admin-list.json" -w '%{http_code}' --max-time 25   "$API_ROOT/api/admin/leads/?limit=100"   -H "authorization: Bearer $ADMIN_SECRET")"
expect_http 200 "$admin_http" "admin-list"
jq -e '.ok == true' "$STATUS_DIR/admin-list.json" >/dev/null
while IFS= read -r ref; do
  [[ -n "$ref" ]] || continue
  jq -e --arg ref "$ref" '
    ([.leads[]?.lead_ref, .careers[]?.application_ref] | any(. == $ref))
  ' "$STATUS_DIR/admin-list.json" >/dev/null || {
    log "ADMIN_STORAGE_PROOF=FAIL ref=$ref"
    exit 1
  }
done < "$STATUS_DIR/form-refs.txt"
log "ADMIN_STORAGE_PROOF=PASS"

# Explicit cleanup. The controlled test email is reserved for smoke data.
cleanup_body="$(jq -nc --arg e "$EMAIL" '{email:$e,mode:"physical",channel:"all"}')"
cleanup_http="$(curl -sS -o "$STATUS_DIR/cleanup.json" -w '%{http_code}' --max-time 25   -X POST "$API_ROOT/api/admin/leads/delete/"   -H "authorization: Bearer $ADMIN_SECRET"   -H 'content-type: application/json'   -d "$cleanup_body")"
expect_http 200 "$cleanup_http" "cleanup"
jq -e '.ok == true and .mode == "physical"' "$STATUS_DIR/cleanup.json" >/dev/null
log "SMOKE_CLEANUP=PASS"

write_status smoke "{"marker":"$MARKER","forms":6,"honeypot":true,"idempotency":true,"admin_storage":true,"cleanup":"physical"}"
log "ALL_PUBLIC_FORM_ENTRYPOINTS_E2E=PASS"
log "SMOKE_SCRIPT_COMPLETE"
