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
  if dth_cd_mail_gate_status; then
    dth_cd_log "preflight mail gate PASS"
  else
    dth_cd_log "preflight mail gate BLOCK (reported; apply would abort)"
  fi
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
    echo "PARTIAL_UPLOAD_PROTECTION=BACKUP_PLUS_ORDERED_OVERLAY"
    echo "HTML_UPLOADED_LAST=YES"
    echo "REMOTE_DELETE_BEFORE_UPLOAD=NO"
    echo "ROLLBACK_AVAILABLE=YES"
    echo "UPLOAD_STAGING_DIR=NONE"
    echo "SWITCH_METHOD=direct_overlay_assets_routes_root_html_htaccess"
    echo "FRESH_BACKUP_REQUIRED=YES"
    echo "APPLY=$APPLY"
    echo "CHECKDOMAIN_UPLOAD_EXECUTED=NO"
    if dth_cd_mail_gate_status >/tmp/dth-cd-mail-gate-plan.$$ 2>/dev/null; then
      echo "CUSTOMER_TRAFFIC_MAIL_GATE=PASS"
    else
      echo "CUSTOMER_TRAFFIC_MAIL_GATE=BLOCK"
    fi
    # shellcheck disable=SC1090
    cat /tmp/dth-cd-mail-gate-plan.$$
    rm -f /tmp/dth-cd-mail-gate-plan.$$
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
  local manifest_tmp
  manifest_tmp="$(mktemp)"
  (
    cd "$backup_dir"
    find . -type f ! -name 'MANIFEST.sha256' | LC_ALL=C sort | while IFS= read -r f; do
      shasum -a 256 "$f"
    done
  ) > "$manifest_tmp"
  mv "$manifest_tmp" "$backup_dir/MANIFEST.sha256"
  [[ -s "$backup_dir/MANIFEST.sha256" ]] || dth_cd_die "backup_manifest_empty"
  [[ -f "$backup_dir/.htaccess" ]] || dth_cd_die "backup_missing_htaccess"
  (
    cd "$backup_dir"
    shasum -a 256 -c MANIFEST.sha256 >/dev/null
  ) || dth_cd_die "backup_manifest_verification_failed"
  printf 'created_epoch=%s\n' "$(date +%s)" > "${backup_dir}.meta"
  chmod 600 "${backup_dir}.meta" 2>/dev/null || true
  echo "$stamp" > "${CHECKDOMAIN_BACKUP_ROOT:-$HOME/.dth-checkdomain-backups}/LATEST"
  dth_cd_log "REMOTE_BACKUP_EXECUTED=YES stamp=$stamp manifest=MANIFEST.sha256 verified=YES"
}

cmd_upload() {
  dth_cd_load_config
  dth_cd_require_out
  {
    echo "UPLOAD_PLAN=YES"
    echo "STAGING=NONE"
    echo "ORDER=1__next 2_images_business 3_other_directories 4_root_non_html 5_root_html 6_htaccess"
    echo "REMOTE_DELETE_BEFORE_UPLOAD=NO"
    echo "FRESH_BACKUP_REQUIRED=YES"
    echo "APPLY=$APPLY"
    echo "MAIL_MODE=${LEADS_MAIL_MODE}"
    echo "ALLOW_MOCK_MAIL_CUTOVER=${ALLOW_MOCK_MAIL_CUTOVER}"
  } | tee -a "$DTH_CD_EVID/checkdomain-deploy-plan.txt"

  if [[ "$APPLY" != "YES" ]]; then
    if ! dth_cd_mail_gate_status >/dev/null; then
      echo "CUSTOMER_TRAFFIC_MAIL_GATE=BLOCK (dry-run; apply would abort)"
    else
      echo "CUSTOMER_TRAFFIC_MAIL_GATE=PASS (dry-run; apply would proceed on mail gate)"
    fi
    dth_cd_log "upload dry-run only (UPLOAD_EXECUTED=NO)"
    echo "UPLOAD_EXECUTED=NO"
    return 0
  fi

  dth_cd_mail_gate
  [[ -n "${CHECKDOMAIN_SSH_IDENTITY:-}" ]] || dth_cd_die "upload_apply_requires_CHECKDOMAIN_SSH_IDENTITY"

  # A live overlay is allowed only after a recent, verified backup of the current site.
  local root_b latest backup_dir backup_meta created_epoch now_epoch backup_age
  root_b="${CHECKDOMAIN_BACKUP_ROOT:-$HOME/.dth-checkdomain-backups}"
  latest="$(cat "$root_b/LATEST" 2>/dev/null || true)"
  [[ -n "$latest" ]] || dth_cd_die "upload_requires_backup_ref"
  backup_dir="$root_b/$latest"
  backup_meta="${backup_dir}.meta"
  [[ -f "$backup_dir/MANIFEST.sha256" ]] || dth_cd_die "upload_requires_backup_manifest"
  [[ -f "$backup_dir/.htaccess" ]] || dth_cd_die "upload_requires_backup_htaccess"
  [[ -f "$backup_meta" ]] || dth_cd_die "upload_requires_backup_metadata"
  (
    cd "$backup_dir"
    shasum -a 256 -c MANIFEST.sha256 >/dev/null
  ) || dth_cd_die "upload_backup_manifest_verification_failed"
  created_epoch="$(sed -n 's/^created_epoch=//p' "$backup_meta" | head -1)"
  [[ "$created_epoch" =~ ^[0-9]+$ ]] || dth_cd_die "upload_backup_timestamp_invalid"
  now_epoch="$(date +%s)"
  backup_age=$((now_epoch - created_epoch))
  if (( backup_age < 0 || backup_age > 14400 )); then
    dth_cd_die "upload_requires_fresh_backup max_age_seconds=14400 actual=${backup_age}"
  fi
  dth_cd_log "backup_gate=PASS ref=$latest age_seconds=$backup_age"

  # Ordered overlay from the already-verified local static build.
  # There is deliberately no fake remote staging copy: rollback is the verified backup above.
  local batch dir file base
  batch="$(mktemp)"
  {
    echo "cd ${CHECKDOMAIN_REMOTE_BASE}"
    echo "lcd ${CHECKDOMAIN_LOCAL_OUT}"

    # Immutable/runtime assets first so newly uploaded HTML never points at missing chunks.
    for dir in _next images business; do
      if [[ -d "${CHECKDOMAIN_LOCAL_OUT}/$dir" ]]; then
        echo "put -r $dir"
      fi
    done

    # Remaining route/static directories after core assets.
    for dir in "${CHECKDOMAIN_LOCAL_OUT}"/*; do
      [[ -d "$dir" ]] || continue
      base="$(basename "$dir")"
      case "$base" in
        _next|images|business) continue ;;
      esac
      echo "put -r $base"
    done

    # .dth-build stays local as release evidence. Never publish operational metadata.

    # Root non-HTML files next. Hidden .htaccess is deliberately held until the end.
    for file in "${CHECKDOMAIN_LOCAL_OUT}"/*; do
      [[ -f "$file" ]] || continue
      base="$(basename "$file")"
      case "$base" in
        *.html) continue ;;
      esac
      echo "put $base"
    done

    # Root HTML last, after every asset/directory it can reference is present.
    for file in "${CHECKDOMAIN_LOCAL_OUT}"/*.html; do
      [[ -f "$file" ]] || continue
      base="$(basename "$file")"
      echo "put $base"
    done

    # Routing/security policy changes become active only after content is in place.
    if [[ -f "${CHECKDOMAIN_LOCAL_OUT}/.htaccess" ]]; then
      echo "put .htaccess"
    fi

    # Exact retired public artifacts only. Each deletion is non-fatal if the old
    # file is already absent. Generic remote pruning is deliberately forbidden.
    echo "-rm google-apps-script.js"
    echo "-rm RECAPTCHA_SETUP.md"
    echo "-rm RECAPTCHA_QUICKSTART.md"
    echo "-rm INTEGRATION_SUMMARY.md"
    echo "-rm images/tari.png"
  } > "$batch"

  sftp -oBatchMode=yes -i "$CHECKDOMAIN_SSH_IDENTITY" -b "$batch" \
    "${CHECKDOMAIN_USER}@${CHECKDOMAIN_HOST}"
  rm -f "$batch"
  echo "UPLOAD_EXECUTED=YES"
  echo "UPLOAD_BACKUP_REF=$latest"
  echo "UPLOAD_ORDERED_OVERLAY=YES"
}

cmd_verify() {
  local base="${CHECKDOMAIN_VERIFY_BASE:-https://www.deintarifheld.de}"
  {
    echo "VERIFY_BASE=$base"
    echo "CHECKS=/ /unternehmen/ /karriere/ /rechner/ /datenschutz/"
    echo "EXPECT_SECURITY_HEADERS=YES"
    echo "EXPECT_BUILD_METADATA_PUBLIC=NO"
    echo "EXPECT_HOME_HASH_PARITY=YES_IF_LOCAL_OUT_PRESENT"
    echo "APPLY=$APPLY"
  } | tee "$DTH_CD_EVID/checkdomain-verify-plan.txt"
  if [[ "$APPLY" != "YES" ]]; then
    echo "VERIFY_EXECUTED=NO"
    return 0
  fi

  local failed=0 path code
  for path in / /unternehmen/ /karriere/ /rechner/ /datenschutz/; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "${base}${path}" || true)"
    echo "LIVE ${path} HTTP_${code:-ERR}"
    if [[ "$code" != "200" ]]; then
      failed=1
    fi
  done

  local headers_file body_file metadata_code
  headers_file="$(mktemp)"
  body_file="$(mktemp)"
  trap 'rm -f "$headers_file" "$body_file"' RETURN

  code="$(curl -sS -D "$headers_file" -o "$body_file" -w '%{http_code}' --max-time 20 "${base}/" || true)"
  if [[ "$code" != "200" ]]; then
    echo "HOME_FETCH=FAIL status=${code:-ERR}"
    failed=1
  else
    echo "HOME_FETCH=PASS"
  fi

  for header in strict-transport-security x-content-type-options x-frame-options content-security-policy referrer-policy permissions-policy; do
    if grep -qi "^${header}:" "$headers_file"; then
      echo "HEADER_${header^^}=PASS"
    else
      echo "HEADER_${header^^}=FAIL"
      failed=1
    fi
  done

  metadata_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "${base}/.dth-build/build-metadata.json" || true)"
  if [[ "$metadata_code" == "200" ]]; then
    echo "PUBLIC_BUILD_METADATA=FAIL status=200"
    failed=1
  else
    echo "PUBLIC_BUILD_METADATA=PASS status=${metadata_code:-ERR}"
  fi

  local retired_path retired_code
  for retired_path in google-apps-script.js RECAPTCHA_SETUP.md RECAPTCHA_QUICKSTART.md INTEGRATION_SUMMARY.md images/tari.png; do
    retired_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "${base}/${retired_path}" || true)"
    if [[ "$retired_code" == "200" ]]; then
      echo "RETIRED_PUBLIC_ARTIFACT=FAIL path=${retired_path} status=200"
      failed=1
    else
      echo "RETIRED_PUBLIC_ARTIFACT=PASS path=${retired_path} status=${retired_code:-ERR}"
    fi
  done

  if [[ -n "${CHECKDOMAIN_LOCAL_OUT:-}" && -f "${CHECKDOMAIN_LOCAL_OUT}/index.html" && "$code" == "200" ]]; then
    local local_hash live_hash
    local_hash="$(shasum -a 256 "${CHECKDOMAIN_LOCAL_OUT}/index.html" | awk '{print $1}')"
    live_hash="$(shasum -a 256 "$body_file" | awk '{print $1}')"
    if [[ "$local_hash" == "$live_hash" ]]; then
      echo "LIVE_EQUALS_LOCAL_INDEX=YES"
    else
      echo "LIVE_EQUALS_LOCAL_INDEX=NO"
      failed=1
    fi
  else
    echo "LIVE_EQUALS_LOCAL_INDEX=NOT_CHECKED"
  fi

  if (( failed != 0 )); then
    echo "VERIFY_EXECUTED=YES"
    echo "VERIFY_PASS=NO"
    return 1
  fi

  echo "VERIFY_EXECUTED=YES"
  echo "VERIFY_PASS=YES"
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
  [[ -f "${root_b}/${latest}/.htaccess" ]] || dth_cd_die "rollback_backup_missing_htaccess"
  [[ -f "${root_b}/${latest}/MANIFEST.sha256" ]] || dth_cd_die "rollback_backup_missing_manifest"
  (
    cd "${root_b}/${latest}"
    shasum -a 256 -c MANIFEST.sha256 >/dev/null
  ) || dth_cd_die "rollback_backup_manifest_verification_failed"
  local batch
  batch="$(mktemp)"
  {
    echo "cd ${CHECKDOMAIN_REMOTE_BASE}"
    echo "lcd ${root_b}/${latest}"
    # Hidden routing/security file is never covered by the '*' wildcard.
    echo "put .htaccess"
    if [[ -d "${root_b}/${latest}/.dth-build" ]]; then
      echo "put -r .dth-build"
    fi
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
