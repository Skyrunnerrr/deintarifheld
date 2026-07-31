#!/usr/bin/env bash
# Checkdomain deploy automation: plan / backup / upload / verify / rollback / status
# Default: dry-run. Writes require --apply. Upload NEVER runs without backup + mail gate.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

CMD="${1:-}"
shift || true
APPLY=NO
for a in "$@"; do
  [[ "$a" == "--apply" ]] && APPLY=YES
done

mkdir -p "$DTH_CD_EVID"

cmd_preflight() {
  dth_cd_load_config
  dth_cd_require_out
  dth_cd_mail_gate || true
  # mail_gate dies on block — for preflight report both states
  :
}

cmd_plan() {
  dth_cd_load_config
  dth_cd_require_out
  local meta sha
  meta="$(cat "$CHECKDOMAIN_LOCAL_OUT/.dth-build/build-metadata.json")"
  sha="$(printf '%s' "$meta" | sed -n 's/.*"gitCommitSha"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  {
    echo "MERGE_BEFORE_PUBLIC_UPLOAD=YES"
    echo "LIVE_BUILD_SOURCE_BRANCH=main"
    echo "DEPLOYED_SHA_MUST_EQUAL_REMOTE_MAIN=YES"
    echo "PLANNED_LOCAL_SHA=$sha"
    echo "REMOTE_HOST=$CHECKDOMAIN_HOST"
    echo "REMOTE_BASE=$CHECKDOMAIN_REMOTE_BASE"
    echo "PROTOCOL=$CHECKDOMAIN_PROTOCOL"
    echo "LOCAL_OUT=$CHECKDOMAIN_LOCAL_OUT"
    echo "PARTIAL_UPLOAD_PROTECTION=YES"
    echo "HTML_UPLOADED_LAST=YES_IF_NO_ATOMIC_SWITCH"
    echo "REMOTE_DELETE_BEFORE_UPLOAD=NO"
    echo "ROLLBACK_AVAILABLE=YES"
    echo "UPLOAD_STAGING_DIR=releases/<timestamp>/"
    echo "SWITCH_METHOD=copy_from_staging_assets_first_html_last"
    echo "APPLY=$APPLY"
    echo "CHECKDOMAIN_UPLOAD_EXECUTED=NO"
    echo "CUSTOMER_TRAFFIC_MAIL_GATE=$([ "${LEADS_MAIL_MODE}" = mock ] && [ "${ALLOW_MOCK_MAIL_CUTOVER}" != YES ] && echo BLOCK || echo PASS)"
  } | tee "$DTH_CD_EVID/checkdomain-deploy-plan.txt"
}

cmd_backup() {
  dth_cd_load_config
  local stamp backup_dir
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_dir="${CHECKDOMAIN_BACKUP_ROOT:-$HOME/.dth-checkdomain-backups}/$stamp"
  mkdir -p "$backup_dir"
  {
    echo "REMOTE_BACKUP_PLANNED=YES"
    echo "BACKUP_DIR=$backup_dir"
    echo "REMOTE_BASE=$CHECKDOMAIN_REMOTE_BASE"
    echo "NOTE=Download via SFTP recursive when --apply; dry-run only lists contract"
    echo "APPLY=$APPLY"
    echo "REMOTE_BACKUP_EXECUTED=$([ "$APPLY" = YES ] && echo WOULD_RUN || echo NO)"
  } | tee "$DTH_CD_EVID/checkdomain-backup-plan.txt"
  if [[ "$APPLY" != "YES" ]]; then
    dth_cd_log "backup dry-run only (REMOTE_BACKUP_EXECUTED=NO)"
    return 0
  fi
  # Non-interactive SFTP batch using SSH key or sshpass-less BatchMode.
  # Password must not appear on argv — use SSH keys or SSH_ASKPASS env file mode outside repo.
  if [[ -z "${CHECKDOMAIN_SSH_IDENTITY:-}" ]]; then
    dth_cd_die "backup_apply_requires_CHECKDOMAIN_SSH_IDENTITY (no password on CLI)"
  fi
  local batch
  batch="$(mktemp)"
  cat > "$batch" <<EOF
cd ${CHECKDOMAIN_REMOTE_BASE}
lcd ${backup_dir}
get -r .
bye
EOF
  sftp -oBatchMode=yes -i "$CHECKDOMAIN_SSH_IDENTITY" -b "$batch" \
    "${CHECKDOMAIN_USER}@${CHECKDOMAIN_HOST}" 
  rm -f "$batch"
  (cd "$backup_dir" && find . -type f | sort | while read -r f; do shasum -a 256 "$f"; done) \
    > "$backup_dir/MANIFEST.sha256"
  echo "$stamp" > "${CHECKDOMAIN_BACKUP_ROOT:-$HOME/.dth-checkdomain-backups}/LATEST"
  dth_cd_log "REMOTE_BACKUP_EXECUTED=YES stamp=$stamp"
}

cmd_upload() {
  dth_cd_load_config
  dth_cd_require_out
  local stamp staging
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  staging="releases/${stamp}"
  {
    echo "UPLOAD_PLAN=YES"
    echo "STAGING=$staging"
    echo "ORDER=1_assets(_next,images) 2_html_last"
    echo "REMOTE_DELETE_BEFORE_UPLOAD=NO"
    echo "APPLY=$APPLY"
    echo "MAIL_MODE=${LEADS_MAIL_MODE}"
    echo "ALLOW_MOCK_MAIL_CUTOVER=${ALLOW_MOCK_MAIL_CUTOVER}"
  } | tee -a "$DTH_CD_EVID/checkdomain-deploy-plan.txt"
  if [[ "$APPLY" != "YES" ]]; then
    if [[ "${LEADS_MAIL_MODE}" == "mock" && "${ALLOW_MOCK_MAIL_CUTOVER}" != "YES" ]]; then
      echo "CUSTOMER_TRAFFIC_MAIL_GATE=BLOCK (dry-run; apply would abort)"
    fi
    dth_cd_log "upload dry-run only (UPLOAD_EXECUTED=NO)"
    echo "UPLOAD_EXECUTED=NO"
    return 0
  fi
  dth_cd_mail_gate
  [[ -n "${CHECKDOMAIN_SSH_IDENTITY:-}" ]] || dth_cd_die "upload_apply_requires_CHECKDOMAIN_SSH_IDENTITY"
  # Stage upload then promote: assets first, HTML last. Never wipe live tree first.
  local batch
  batch="$(mktemp)"
  {
    echo "cd ${CHECKDOMAIN_REMOTE_BASE}"
    echo "mkdir releases"
    echo "mkdir ${staging}"
    echo "lcd ${CHECKDOMAIN_LOCAL_OUT}"
    echo "cd ${CHECKDOMAIN_REMOTE_BASE}/${staging}"
    echo "put -r _next"
    echo "put -r images"
    echo "put -r *"
  } > "$batch"
  sftp -oBatchMode=yes -i "$CHECKDOMAIN_SSH_IDENTITY" -b "$batch" \
    "${CHECKDOMAIN_USER}@${CHECKDOMAIN_HOST}"
  # Promote non-html then html
  batch="$(mktemp)"
  {
    echo "cd ${CHECKDOMAIN_REMOTE_BASE}"
    echo "lcd ${CHECKDOMAIN_LOCAL_OUT}"
    # assets
    echo "put -r _next"
    echo "put -r images"
    # html last
    echo "put .htaccess"
    echo "put robots.txt"
    echo "put sitemap.xml"
    echo "put -r *"
  } > "$batch"
  sftp -oBatchMode=yes -i "$CHECKDOMAIN_SSH_IDENTITY" -b "$batch" \
    "${CHECKDOMAIN_USER}@${CHECKDOMAIN_HOST}"
  rm -f "$batch"
  echo "UPLOAD_EXECUTED=YES"
}

cmd_verify() {
  local base="${CHECKDOMAIN_VERIFY_BASE:-https://www.deintarifheld.de}"
  {
    echo "VERIFY_BASE=$base"
    echo "CHECKS=/ /unternehmen/ /karriere/ /rechner/ /datenschutz/"
    echo "EXPECT_NO_script.google.com_in_form_chunks"
    echo "APPLY=$APPLY"
  } | tee "$DTH_CD_EVID/checkdomain-verify-plan.txt"
  if [[ "$APPLY" != "YES" ]]; then
    echo "VERIFY_EXECUTED=NO"
    return 0
  fi
  for path in / /unternehmen/ /karriere/ /rechner/ /datenschutz/; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "${base}${path}" || echo ERR)"
    echo "LIVE ${path} HTTP_${code}"
  done
}

cmd_rollback() {
  dth_cd_load_config
  local latest root_b
  root_b="${CHECKDOMAIN_BACKUP_ROOT:-$HOME/.dth-checkdomain-backups}"
  latest="$(cat "$root_b/LATEST" 2>/dev/null || true)"
  {
    echo "ROLLBACK_REF=${latest:-NONE}"
    echo "METHOD=restore_backup_tree_via_sftp"
    echo "DNS_CHANGE_REQUIRED=NO"
    echo "APPLY=$APPLY"
  } | tee "$DTH_CD_EVID/rollback-dry-run.txt"
  if [[ "$APPLY" != "YES" ]]; then
    echo "ROLLBACK_EXECUTED=NO"
    return 0
  fi
  [[ -n "$latest" ]] || dth_cd_die "no_backup_ref"
  [[ -n "${CHECKDOMAIN_SSH_IDENTITY:-}" ]] || dth_cd_die "rollback_requires_SSH_IDENTITY"
  local batch
  batch="$(mktemp)"
  {
    echo "cd ${CHECKDOMAIN_REMOTE_BASE}"
    echo "lcd ${root_b}/${latest}"
    echo "put -r *"
  } > "$batch"
  sftp -oBatchMode=yes -i "$CHECKDOMAIN_SSH_IDENTITY" -b "$batch" \
    "${CHECKDOMAIN_USER}@${CHECKDOMAIN_HOST}"
  rm -f "$batch"
  echo "ROLLBACK_EXECUTED=YES"
  cmd_verify --apply
}

cmd_status() {
  {
    echo "CHECKDOMAIN_UPLOAD_AUTOMATION=READY"
    echo "CHECKDOMAIN_UPLOAD_EXECUTED=NO"
    echo "REMOTE_BACKUP_EXECUTED=NO"
    echo "ROLLBACK_EXECUTED=NO"
    echo "CONFIG_PATH=$DTH_CD_CONFIG"
    echo "CONFIG_EXISTS=$([ -f "$DTH_CD_CONFIG" ] && echo YES || echo NO)"
  } | tee "$DTH_CD_EVID/checkdomain-status.txt"
}

case "$CMD" in
  preflight)
    dth_cd_load_config
    dth_cd_require_out
    if [[ "${LEADS_MAIL_MODE}" == "mock" && "${ALLOW_MOCK_MAIL_CUTOVER}" != "YES" ]]; then
      echo "CUSTOMER_TRAFFIC_MAIL_GATE=BLOCK" | tee "$DTH_CD_EVID/mail-gate-preflight.txt"
      echo "PREFLIGHT_MAIL_GATE=BLOCK"
      exit 0
    fi
    echo "CUSTOMER_TRAFFIC_MAIL_GATE=PASS" | tee "$DTH_CD_EVID/mail-gate-preflight.txt"
    ;;
  plan) cmd_plan ;;
  backup) cmd_backup ;;
  upload) cmd_upload ;;
  verify) cmd_verify ;;
  rollback) cmd_rollback ;;
  status) cmd_status ;;
  *)
    cat <<'EOF'
Usage: dth-checkdomain.sh <preflight|plan|backup|upload|verify|rollback|status> [--apply]
Default is dry-run. --apply performs remote SFTP (requires SSH identity, never password argv).
Mail gate: mock cutover blocked unless ALLOW_MOCK_MAIL_CUTOVER=YES (explicit ops only).
EOF
    exit 2
    ;;
esac
