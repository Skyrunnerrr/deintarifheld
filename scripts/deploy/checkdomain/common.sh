#!/usr/bin/env bash
# Shared helpers for Checkdomain static deploy (SFTP/FTP). No credentials in logs.
set -euo pipefail

DTH_CD_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DTH_CD_EVID="${DTH_09A_EVID:-/tmp/dth-09a-production-cutover-candidate}"
DTH_CD_CONFIG="${CHECKDOMAIN_DEPLOY_CONFIG:-$DTH_CD_ROOT/infra/checkdomain/config.env}"
DTH_CD_EXAMPLE="$DTH_CD_ROOT/infra/checkdomain/config.example.env"

dth_cd_log() { printf '[checkdomain] %s\n' "$*"; }
dth_cd_die() { printf '[checkdomain] ERROR %s\n' "$*" >&2; exit 1; }

dth_cd_load_config() {
  [[ -f "$DTH_CD_CONFIG" ]] || dth_cd_die "missing_config path=$DTH_CD_CONFIG (copy from config.example.env, chmod 0600)"
  local mode
  mode="$(stat -f '%Lp' "$DTH_CD_CONFIG" 2>/dev/null || stat -c '%a' "$DTH_CD_CONFIG" 2>/dev/null || echo '')"
  if [[ "$mode" != "600" && "$mode" != "0600" ]]; then
    dth_cd_die "config_permissions_must_be_0600 actual=${mode:-unknown}"
  fi
  # shellcheck disable=SC1090
  set -a
  source "$DTH_CD_CONFIG"
  set +a
  : "${CHECKDOMAIN_HOST:?}"
  : "${CHECKDOMAIN_USER:?}"
  : "${CHECKDOMAIN_REMOTE_BASE:?}"
  : "${CHECKDOMAIN_LOCAL_OUT:?}"
  CHECKDOMAIN_PROTOCOL="${CHECKDOMAIN_PROTOCOL:-sftp}"
  ALLOW_MOCK_MAIL_CUTOVER="${ALLOW_MOCK_MAIL_CUTOVER:-NO}"
  LEADS_MAIL_MODE="${LEADS_MAIL_MODE:-mock}"
}

dth_cd_mail_gate_status() {
  # Prints gate fields; exit 0=PASS, 1=BLOCK. Used by apply and offline tests.
  local mode="${LEADS_MAIL_MODE:-mock}"
  case "$mode" in
    mock)
      if [[ "${ALLOW_MOCK_MAIL_CUTOVER}" == "YES" ]]; then
        cat <<EOF
CUSTOMER_TRAFFIC_MAIL_GATE=PASS
MAIL_MODE=${mode}
ALLOW_MOCK_MAIL_CUTOVER=YES
INTERNAL_NOTIFICATION=OFF
CUSTOMER_CONFIRMATION=OFF
TEMPORARY_MODE=NO
VERIFIED_CUSTOM_DOMAIN=NO
FOLLOW_UP_REQUIRED=NONE
MOCK_CUTOVER_BLOCKED=NO
FAIL_CUTOVER_BLOCKED=YES
INTERNAL_LIVE_NOTIFICATION_GATE=N/A
CUSTOMER_CONFIRMATION_REPORTED_OFF=YES
TEMPORARY_MODE_EXPLICIT=NO
EOF
        return 0
      fi
      cat <<'EOF'
CUSTOMER_TRAFFIC_MAIL_GATE=BLOCK
ALLOW_MOCK_MAIL_CUTOVER=NO
MAIL_MODE=mock
INTERNAL_NOTIFICATION=OFF
CUSTOMER_CONFIRMATION=OFF
TEMPORARY_MODE=NO
VERIFIED_CUSTOM_DOMAIN=NO
FOLLOW_UP_REQUIRED=OPERATIONAL_NOTIFICATION
MOCK_CUTOVER_BLOCKED=YES
FAIL_CUTOVER_BLOCKED=YES
INTERNAL_LIVE_NOTIFICATION_GATE=FAIL
CUSTOMER_CONFIRMATION_REPORTED_OFF=YES
TEMPORARY_MODE_EXPLICIT=NO
MAIL_IMPACT:
- Leads would be stored in Supabase
- Audit events would be written
- Internal email notification would NOT be sent for real
- Operational risk: unobserved new leads
EOF
      return 1
      ;;
    fail)
      cat <<'EOF'
CUSTOMER_TRAFFIC_MAIL_GATE=BLOCK
MAIL_MODE=fail
INTERNAL_NOTIFICATION=OFF
CUSTOMER_CONFIRMATION=OFF
TEMPORARY_MODE=NO
VERIFIED_CUSTOM_DOMAIN=NO
FOLLOW_UP_REQUIRED=OPERATIONAL_NOTIFICATION
MOCK_CUTOVER_BLOCKED=YES
FAIL_CUTOVER_BLOCKED=YES
INTERNAL_LIVE_NOTIFICATION_GATE=FAIL
CUSTOMER_CONFIRMATION_REPORTED_OFF=YES
TEMPORARY_MODE_EXPLICIT=NO
MAIL_IMPACT:
- Mail path forced to fail (test mode only)
- Not suitable for customer traffic
EOF
      return 1
      ;;
    internal_live)
      cat <<'EOF'
CUSTOMER_TRAFFIC_MAIL_GATE=PASS
MAIL_MODE=internal_live
INTERNAL_NOTIFICATION=LIVE
CUSTOMER_CONFIRMATION=OFF
TEMPORARY_MODE=YES
VERIFIED_CUSTOM_DOMAIN=NO
FOLLOW_UP_REQUIRED=RESEND_DOMAIN_VERIFICATION
MOCK_CUTOVER_BLOCKED=YES
FAIL_CUTOVER_BLOCKED=YES
INTERNAL_LIVE_NOTIFICATION_GATE=PASS
CUSTOMER_CONFIRMATION_REPORTED_OFF=YES
TEMPORARY_MODE_EXPLICIT=YES
EOF
      return 0
      ;;
    live)
      cat <<'EOF'
CUSTOMER_TRAFFIC_MAIL_GATE=PASS
MAIL_MODE=live
INTERNAL_NOTIFICATION=LIVE
CUSTOMER_CONFIRMATION=ON
TEMPORARY_MODE=NO
VERIFIED_CUSTOM_DOMAIN=ASSUMED_CONFIGURED
FOLLOW_UP_REQUIRED=NONE
MOCK_CUTOVER_BLOCKED=YES
FAIL_CUTOVER_BLOCKED=YES
INTERNAL_LIVE_NOTIFICATION_GATE=N/A
CUSTOMER_CONFIRMATION_REPORTED_OFF=NO
TEMPORARY_MODE_EXPLICIT=NO
EOF
      return 0
      ;;
    *)
      cat <<EOF
CUSTOMER_TRAFFIC_MAIL_GATE=BLOCK
MAIL_MODE=${mode}
INTERNAL_NOTIFICATION=UNKNOWN
CUSTOMER_CONFIRMATION=OFF
TEMPORARY_MODE=NO
VERIFIED_CUSTOM_DOMAIN=NO
FOLLOW_UP_REQUIRED=OPERATIONAL_NOTIFICATION
MOCK_CUTOVER_BLOCKED=YES
FAIL_CUTOVER_BLOCKED=YES
INTERNAL_LIVE_NOTIFICATION_GATE=FAIL
CUSTOMER_CONFIRMATION_REPORTED_OFF=YES
TEMPORARY_MODE_EXPLICIT=NO
EOF
      return 1
      ;;
  esac
}

dth_cd_mail_gate() {
  local rc=0
  dth_cd_mail_gate_status || rc=$?
  if [[ "$rc" -ne 0 ]]; then
    dth_cd_die "mail_gate_blocked mode=${LEADS_MAIL_MODE:-mock}"
  fi
  dth_cd_log "CUSTOMER_TRAFFIC_MAIL_GATE=PASS mode=${LEADS_MAIL_MODE} allow_mock=${ALLOW_MOCK_MAIL_CUTOVER}"
}

dth_cd_require_out() {
  [[ -d "$CHECKDOMAIN_LOCAL_OUT" ]] || dth_cd_die "missing_out dir=$CHECKDOMAIN_LOCAL_OUT"
  [[ -f "$CHECKDOMAIN_LOCAL_OUT/.dth-build/build-metadata.json" ]] || dth_cd_die "missing_build_metadata"
}

dth_cd_redact() {
  sed -E \
    -e 's/[Pp]ass(word)?[=:][^[:space:]]+/pass=REDACTED/g' \
    -e 's/[Tt]oken[=:][^[:space:]]+/token=REDACTED/g' \
    -e 's/re_[A-Za-z0-9]{8,}/[REDACTED_RESEND]/g'
}
