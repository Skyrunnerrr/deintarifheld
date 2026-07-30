#!/usr/bin/env bash
# Shared helpers — never echo secrets.
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_ROOT="${DTH_EVID_ROOT:-/tmp/dth-07a-checkdomain-api-recovery}"
STATUS_DIR="${EVID_ROOT}/status"
mkdir -p "$STATUS_DIR"

CONFIG_FILE="${DTH_INFRA_CONFIG:-$ROOT/infra/phase-a/config.env}"
EXAMPLE_CONFIG="$ROOT/infra/phase-a/config.example.env"

redact() {
  # stdin → stdout with common secret-like patterns masked
  sed -E \
    -e 's/(eyJ[A-Za-z0-9_-]{10,})/[REDACTED_JWT]/g' \
    -e 's/(re_[A-Za-z0-9]{8,})/[REDACTED_RESEND]/g' \
    -e 's/(sk_[A-Za-z0-9]{8,})/[REDACTED]/g' \
    -e 's/(gh[pousr]_[A-Za-z0-9]{10,})/[REDACTED_GH]/g' \
    -e 's/(Bearer )[A-Za-z0-9._~+/=-]{8,}/\1[REDACTED]/g'
}

log() { printf '[dth-infra] %s\n' "$*" | redact; }

write_status() {
  local name="$1"
  local json="$2"
  printf '%s\n' "$json" > "$STATUS_DIR/${name}.json"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    log "MISSING_COMMAND=$1"
    return 1
  }
}

npx_vercel() { npx --yes vercel@latest "$@"; }
npx_supabase() { npx --yes supabase@latest "$@"; }

load_config_if_present() {
  # Safe KEY=VALUE loader (supports spaces/<> in values; never eval arbitrary shell)
  if [[ -f "$CONFIG_FILE" ]]; then
    eval "$(python3 - "$CONFIG_FILE" <<'PY'
import shlex, sys
from pathlib import Path
p = Path(sys.argv[1])
for line in p.read_text().splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, v = s.split("=", 1)
    k = k.strip()
    v = v.strip()
    if len(v) >= 2 and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
        v = v[1:-1]
    if not k.isidentifier():
        continue
    print(f"export {k}={shlex.quote(v)}")
PY
)"
  fi
}

present() {
  local n="$1"
  local v="${!n-}"
  if [[ -n "${v// }" ]]; then
    printf 'PRESENT=YES'
  else
    printf 'PRESENT=NO'
  fi
}

exit_token() {
  local token="$1"
  write_status final "{\"FINAL_TOKEN\":\"$token\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
  log "FINAL_TOKEN=$token"
  case "$token" in
    READY_* ) exit 0 ;;
    * ) exit 2 ;;
  esac
}
