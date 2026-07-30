#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
load_config_if_present

cd "$ROOT"
echo "ROOT=$ROOT"
echo "BRANCH=$(git branch --show-current)"
echo "HEAD=$(git rev-parse HEAD)"
echo "EVID=$EVID_ROOT"
echo "CONFIG_PRESENT=$([[ -f $CONFIG_FILE ]] && echo YES || echo NO)"
echo "MIGRATION_PRESENT=$([[ -f $ROOT/supabase/migrations/001_leads_phase_a.sql ]] && echo YES || echo NO)"
echo "VERCEL_JSON_CRON=$(jq -r '.crons[0].schedule // empty' "$ROOT/vercel.json")"
echo "PACKAGE_SCRIPTS=$(jq -r 'keys[]' <<<"$(jq '.scripts' package.json)" | tr '\n' ' ')"

for f in preflight plan apply final; do
  if [[ -f "$STATUS_DIR/${f}.json" ]]; then
    echo "STATUS_${f}=PRESENT"
  else
    echo "STATUS_${f}=ABSENT"
  fi
done

if [[ -f "$STATUS_DIR/final.json" ]]; then
  jq -r '.FINAL_TOKEN // empty' "$STATUS_DIR/final.json" | sed 's/^/LAST_FINAL_TOKEN=/'
fi
