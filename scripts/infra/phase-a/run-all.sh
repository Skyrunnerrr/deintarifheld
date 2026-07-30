#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

CMD="${1:-status}"
shift || true

case "$CMD" in
  preflight) exec "$SCRIPT_DIR/preflight.sh" "$@" ;;
  plan) exec "$SCRIPT_DIR/plan.sh" "$@" ;;
  dns) exec "$SCRIPT_DIR/configure-dns.sh" "$@" ;;
  apply) exec "$SCRIPT_DIR/apply.sh" "$@" ;;
  status) exec "$SCRIPT_DIR/status.sh" "$@" ;;
  smoke) exec "$SCRIPT_DIR/smoke-preview.sh" "$@" ;;
  *)
    log "Usage: run-all.sh {preflight|plan|dns|apply|status|smoke}"
    exit 2
    ;;
esac
