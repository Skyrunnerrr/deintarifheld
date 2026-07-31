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

dth_cd_mail_gate() {
  if [[ "${LEADS_MAIL_MODE}" == "mock" && "${ALLOW_MOCK_MAIL_CUTOVER}" != "YES" ]]; then
    cat <<'EOF'
CUSTOMER_TRAFFIC_MAIL_GATE=BLOCK
ALLOW_MOCK_MAIL_CUTOVER=NO
MAIL_IMPACT:
- Leads would be stored in Supabase
- Audit events would be written
- Internal email notification would NOT be sent for real
- Operational risk: unobserved new leads
EOF
    dth_cd_die "mail_gate_blocked set ALLOW_MOCK_MAIL_CUTOVER=YES only with explicit ops order"
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
