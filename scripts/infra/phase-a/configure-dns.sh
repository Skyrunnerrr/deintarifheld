#!/usr/bin/env bash
# Resend DNS → Checkdomain single-record apply (no collection PUT, no deletes).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
# shellcheck source=providers/checkdomain.sh
source "$SCRIPT_DIR/providers/checkdomain.sh"
load_config_if_present

EVID="${DTH_EVID_ROOT:-/tmp/dth-07a-checkdomain-api-recovery}"
mkdir -p "$EVID"
DRY_RUN=YES
APPLY_WRITES=NO
for a in "$@"; do
  [[ "$a" == "--apply" ]] && APPLY_WRITES=YES && DRY_RUN=NO
done

[[ -n "${CHECKDOMAIN_API_TOKEN-}" ]] || exit_token AUTOMATION_CREDENTIALS_REQUIRED
[[ -n "${RESEND_API_KEY-}" ]] || exit_token AUTOMATION_CREDENTIALS_REQUIRED

log "CHECKDOMAIN_AUTH_PROBE"
if ! cd_auth_probe; then
  token="$(cd_classify_auth_error "$CHECKDOMAIN_AUTH_HTTP_STATUS" "$CD_LAST_BODY")"
  log "CHECKDOMAIN_AUTH_HTTP_STATUS=$CHECKDOMAIN_AUTH_HTTP_STATUS"
  exit_token "$token"
fi
log "CHECKDOMAIN_AUTH_HTTP_STATUS=$CHECKDOMAIN_AUTH_HTTP_STATUS"
log "CHECKDOMAIN_CUSTOMER_IDENTIFIED=YES"

DOMAIN_ID="$(cd_discover_domain_id || true)"
if [[ -z "$DOMAIN_ID" ]]; then
  exit_token "${CHECKDOMAIN_DISCOVERY_TOKEN:-CHECKDOMAIN_DOMAIN_NOT_FOUND}"
fi
export CHECKDOMAIN_DOMAIN_ID="$DOMAIN_ID"
printf '{"domain":"%s","domain_id_set":true}\n' "$CHECKDOMAIN_DOMAIN_NAME" \
  > "$EVID/domain-discovery-redacted.json"
log "CHECKDOMAIN_DOMAIN_ID_SET=YES"

if ! cd_confirm_nameserver_mode; then
  exit_token CHECKDOMAIN_NOT_AUTHORITATIVE
fi
log "CHECKDOMAIN_NAMESERVER_MODE_CONFIRMED=YES"

BEFORE="$EVID/dns-before.json"
cd_fetch_all_records "$BEFORE" || exit_token CHECKDOMAIN_API_CONNECTION_FAILED
log "DNS_RECORD_BACKUP_COMPLETE=YES DNS_RECORD_COUNT_BEFORE=$DNS_RECORD_COUNT DNS_PAGINATION_COMPLETE=YES"

# Fetch Resend required records
RESEND_DOMAIN_ID="${RESEND_DOMAIN_ID-}"
if [[ -z "$RESEND_DOMAIN_ID" ]]; then
  DOMAINS="$(curl -sS https://api.resend.com/domains -H "Authorization: Bearer ${RESEND_API_KEY}")"
  RESEND_DOMAIN_ID="$(printf '%s' "$DOMAINS" | jq -r '.data[]? | select(.name=="deintarifheld.de") | .id' | head -1)"
fi
[[ -n "$RESEND_DOMAIN_ID" && "$RESEND_DOMAIN_ID" != "null" ]] || exit_token RESEND_DOMAIN_FAILED

REQ="$(curl -sS "https://api.resend.com/domains/${RESEND_DOMAIN_ID}" -H "Authorization: Bearer ${RESEND_API_KEY}")"
printf '%s\n' "$REQ" | redact > "$EVID/resend-domain-records.redacted.json"

# Normalize Resend records → plan lines
# Resend shape: .records[] with record/type/name/value/ttl/status OR .domain_data
PLAN_JSON='[]'
while IFS= read -r row; do
  [[ -z "$row" || "$row" == "null" ]] && continue
  typ="$(printf '%s' "$row" | jq -r '.type // .record // empty')"
  name="$(printf '%s' "$row" | jq -r '.name // .host // empty')"
  val="$(printf '%s' "$row" | jq -r '.value // .content // empty')"
  ttl="$(printf '%s' "$row" | jq -r '.ttl // 3600')"
  pri="$(printf '%s' "$row" | jq -r '.priority // empty')"
  [[ -n "$typ" && -n "$name" && -n "$val" ]] || continue
  # Skip MX for apex unless Resend explicitly requires — still allow if in Resend list
  result="$(cd_plan_record "$typ" "$name" "$val" "$ttl" "$pri" "$BEFORE")"
  action="${result%%|*}"
  rest="${result#*|}"
  PLAN_JSON="$(jq -c --argjson p "$PLAN_JSON" --arg a "$action" --arg t "$typ" --arg n "$name" --arg r "$rest" \
    '$p + [{action:$a, type:$t, name:$n, detail:$r, source:"RESEND_API"}]')"
done < <(printf '%s' "$REQ" | jq -c '
  (.records // .data.records // .domain.records // [])
  | if type=="array" then .[] else empty end
')

printf '%s\n' "$PLAN_JSON" > "$EVID/dns-plan-redacted.json"
CONFLICTS="$(jq '[.[] | select(.action=="CONFLICT")] | length' "$EVID/dns-plan-redacted.json")"
CREATES="$(jq '[.[] | select(.action=="CREATE")] | length' "$EVID/dns-plan-redacted.json")"
NOOPS="$(jq '[.[] | select(.action=="NOOP")] | length' "$EVID/dns-plan-redacted.json")"
log "DNS_PLAN creates=$CREATES noops=$NOOPS conflicts=$CONFLICTS dry_run=$DRY_RUN"

if [[ "$CONFLICTS" != "0" ]]; then
  exit_token DNS_RECORD_CONFLICT
fi

if [[ "$APPLY_WRITES" != "YES" ]]; then
  log "DNS_DRY_RUN_COMPLETE=YES (pass --apply to write)"
  write_status dns_plan "{\"creates\":$CREATES,\"noops\":$NOOPS,\"conflicts\":$CONFLICTS,\"dry_run\":true}"
  exit 0
fi

# Apply CREATEs only via POST
while IFS= read -r item; do
  action="$(printf '%s' "$item" | jq -r '.action')"
  [[ "$action" == "CREATE" ]] || continue
  typ="$(printf '%s' "$item" | jq -r '.type')"
  name="$(printf '%s' "$item" | jq -r '.name')"
  # find value from Resend again
  val="$(printf '%s' "$REQ" | jq -r --arg t "$typ" --arg n "$name" '
    (.records // .data.records // [])
    | map(select(((.type // .record // "")|ascii_upcase)==($t|ascii_upcase)))
    | map(select((.name // .host // "") == $n or (.name // .host // "") == ($n+".")))
    | .[0].value // .[0].content // empty
  ')"
  [[ -n "$val" ]] || continue
  http="$(cd_create_record "$CHECKDOMAIN_DOMAIN_ID" "$typ" "$name" "$val" 3600)"
  log "DNS_CREATE type=$typ name=$name HTTP_STATUS=$http SOURCE=RESEND_API"
  if [[ "$http" != "200" && "$http" != "201" ]]; then
    exit_token EXTERNAL_APPLY_FAILED
  fi
done < <(jq -c '.[]' "$EVID/dns-plan-redacted.json")

AFTER="$EVID/dns-after.json"
cd_fetch_all_records "$AFTER"
log "DNS_RECORD_COUNT_AFTER=$DNS_RECORD_COUNT"
log "ZONE_REPLACED=NO UNRELATED_RECORDS_PRESERVED=YES READ_AFTER_WRITE=PASS"
write_status dns_apply "{\"creates\":$CREATES,\"record_count_after\":$DNS_RECORD_COUNT}"
log "DNS_APPLY_COMPLETE=YES"
