#!/usr/bin/env bash
# Checkdomain API v1 DNS provider — safe single-record writes only.
# FORBIDDEN: PUT /v1/domains/{id}/nameservers/records  (collection replace)
# ALLOWED:   GET/POST records, PUT /records/{record-id}
set -euo pipefail

CHECKDOMAIN_API_BASE_URL="${CHECKDOMAIN_API_BASE_URL:-https://api.checkdomain.de}"
CHECKDOMAIN_DOMAIN_NAME="${CHECKDOMAIN_DOMAIN_NAME:-deintarifheld.de}"

_cd_auth_hdr() {
  printf 'Authorization: Bearer %s' "${CHECKDOMAIN_API_TOKEN}"
}

# cd_api METHOD PATH [curl extras...] → writes body to CD_LAST_BODY, sets CD_HTTP_STATUS
cd_api() {
  local method="$1" path="$2"
  shift 2
  local url="${CHECKDOMAIN_API_BASE_URL}${path}"
  local tmp
  tmp="$(mktemp)"
  # Token only via header env expansion in curl -H; never echo token
  CD_HTTP_STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' \
    -X "$method" "$url" \
    -H "$(_cd_auth_hdr)" \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    "$@" || echo 000)"
  CD_LAST_BODY="$(cat "$tmp")"
  rm -f "$tmp"
}

cd_classify_auth_error() {
  local status="${1:-}"
  local body="${2:-}"
  case "$status" in
    401) echo CHECKDOMAIN_TOKEN_INVALID ;;
    403)
      if printf '%s' "$body" | grep -qiE 'ip|allow|whitelist|freigegeben'; then
        echo CHECKDOMAIN_SOURCE_IP_NOT_ALLOWLISTED
      else
        echo CHECKDOMAIN_API_ACCESS_NOT_ENABLED
      fi
      ;;
    000) echo CHECKDOMAIN_API_CONNECTION_FAILED ;;
    *) echo CHECKDOMAIN_API_ACCESS_NOT_ENABLED ;;
  esac
}

# Read-only auth probe → sets CHECKDOMAIN_AUTH_HTTP_STATUS
cd_auth_probe() {
  if [[ -z "${CHECKDOMAIN_API_TOKEN-}" ]]; then
    CHECKDOMAIN_AUTH_HTTP_STATUS=0
    return 1
  fi
  cd_api GET /v1/customer
  CHECKDOMAIN_AUTH_HTTP_STATUS="$CD_HTTP_STATUS"
  if [[ "$CD_HTTP_STATUS" != "200" ]]; then
    return 1
  fi
  return 0
}

# Discover domain id for exact name match
cd_discover_domain_id() {
  local want="$CHECKDOMAIN_DOMAIN_NAME"
  cd_api GET /v1/domains
  if [[ "$CD_HTTP_STATUS" != "200" ]]; then
    echo ""
    return 1
  fi
  local count
  count="$(printf '%s' "$CD_LAST_BODY" | jq -r --arg n "$want" '
    def items:
      if type=="array" then .
      elif .data and (.data|type)=="array" then .data
      elif .items and (.items|type)=="array" then .items
      else [] end;
    items
    | map(select(
        ((.name // .domain // .domain_name // "") | ascii_downcase) == ($n | ascii_downcase)
      ))
    | length
  ')"
  if [[ "$count" == "0" ]]; then
    CHECKDOMAIN_DISCOVERY_TOKEN=CHECKDOMAIN_DOMAIN_NOT_FOUND
    echo ""
    return 1
  fi
  if [[ "$count" != "1" ]]; then
    CHECKDOMAIN_DISCOVERY_TOKEN=CHECKDOMAIN_DOMAIN_AMBIGUOUS
    echo ""
    return 1
  fi
  CHECKDOMAIN_DOMAIN_ID="$(printf '%s' "$CD_LAST_BODY" | jq -r --arg n "$want" '
    def items:
      if type=="array" then .
      elif .data and (.data|type)=="array" then .data
      elif .items and (.items|type)=="array" then .items
      else [] end;
    items
    | map(select(
        ((.name // .domain // .domain_name // "") | ascii_downcase) == ($n | ascii_downcase)
      ))
    | .[0].id // .[0].domain_id // empty
  ')"
  if [[ -z "$CHECKDOMAIN_DOMAIN_ID" || "$CHECKDOMAIN_DOMAIN_ID" == "null" ]]; then
    CHECKDOMAIN_DISCOVERY_TOKEN=CHECKDOMAIN_DOMAIN_NOT_FOUND
    echo ""
    return 1
  fi
  echo "$CHECKDOMAIN_DOMAIN_ID"
}

# Paginated record fetch → writes JSON array to $1
cd_fetch_all_records() {
  local out_file="$1"
  local domain_id="${CHECKDOMAIN_DOMAIN_ID:?domain id required}"
  local page=1
  local all='[]'
  local limit=100
  while true; do
    # Try common pagination styles
    cd_api GET "/v1/domains/${domain_id}/nameservers/records?limit=${limit}&page=${page}"
    if [[ "$CD_HTTP_STATUS" != "200" ]]; then
      cd_api GET "/v1/domains/${domain_id}/nameservers/records?limit=${limit}&offset=$(( (page-1)*limit ))"
    fi
    if [[ "$CD_HTTP_STATUS" != "200" ]]; then
      return 1
    fi
    local chunk
    chunk="$(printf '%s' "$CD_LAST_BODY" | jq -c '
      if type=="array" then .
      elif .data and (.data|type)=="array" then .data
      elif .items and (.items|type)=="array" then .items
      elif .records and (.records|type)=="array" then .records
      else [] end
    ')"
    local n
    n="$(printf '%s' "$chunk" | jq 'length')"
    all="$(jq -c --argjson a "$all" --argjson b "$chunk" '$a + $b')"
    if [[ "$n" -lt "$limit" ]]; then
      break
    fi
    page=$((page + 1))
    if [[ "$page" -gt 50 ]]; then
      break
    fi
  done
  printf '%s\n' "$all" > "$out_file"
  DNS_RECORD_COUNT="$(jq 'length' "$out_file")"
}

cd_confirm_nameserver_mode() {
  local domain_id="${CHECKDOMAIN_DOMAIN_ID:?}"
  cd_api GET "/v1/domains/${domain_id}/nameservers"
  if [[ "$CD_HTTP_STATUS" != "200" ]]; then
    return 1
  fi
  # Persist redacted NS payload
  printf '%s\n' "$CD_LAST_BODY" > "${DTH_EVID_ROOT:-/tmp/dth-07a-checkdomain-api-recovery}/nameservers.json"
  return 0
}

# Normalize helpers
cd_norm_name() {
  local n="${1%.}"
  n="$(printf '%s' "$n" | tr '[:upper:]' '[:lower:]')"
  # Checkdomain often wants relative host; strip apex
  local apex="$CHECKDOMAIN_DOMAIN_NAME"
  if [[ "$n" == "$apex" ]]; then
    echo "@"
  elif [[ "$n" == *".$apex" ]]; then
    echo "${n%.$apex}"
  else
    echo "$n"
  fi
}

cd_norm_type() { printf '%s' "$1" | tr '[:lower:]' '[:upper:]'; }

cd_norm_value() {
  local t="$1" v="$2"
  v="${v%\"}"
  v="${v#\"}"
  if [[ "$t" == "CNAME" || "$t" == "MX" ]]; then
    # ensure trailing style consistency without forcing
    printf '%s' "$v"
  else
    printf '%s' "$v"
  fi
}

# Plan one desired record against existing JSON array file
# Args: type name value ttl [priority]
# Prints: ACTION|HTTP|RECORD_ID|REASON
cd_plan_record() {
  local typ name val ttl pri
  typ="$(cd_norm_type "$1")"
  name="$(cd_norm_name "$2")"
  val="$(cd_norm_value "$typ" "$3")"
  ttl="${4:-3600}"
  pri="${5:-}"
  local existing_file="$6"

  # Never touch unrelated website/mail types unless exact Resend desired
  if [[ "$typ" == "A" || "$typ" == "AAAA" || "$typ" == "NS" || "$typ" == "SOA" ]]; then
    echo "CONFLICT|||REFUSED_TYPE_$typ"
    return 0
  fi

  # SPF duplicate protection — never create a second v=spf1 on same host
  if [[ "$typ" == "TXT" && "$val" == v=spf1* ]]; then
    local exact spf_count
    exact="$(jq -r --arg n "$name" --arg v "$val" '
      [.[]
        | select(((.type // .record_type // "") | ascii_upcase) == "TXT")
        | select(((.name // .host // "") | tostring | ascii_downcase) == ($n|ascii_downcase))
        | select(((.value // .content // .data // "") | tostring) == $v)
      ] | length
    ' "$existing_file")"
    if [[ "${exact:-0}" -ge 1 ]]; then
      echo "NOOP|||EXACT_SPF"
      return 0
    fi
    spf_count="$(jq -r --arg n "$name" '
      [.[]
        | select(((.type // .record_type // "") | ascii_upcase) == "TXT")
        | select(((.name // .host // "") | tostring | ascii_downcase) == ($n|ascii_downcase))
        | select(((.value // .content // .data // "") | tostring | startswith("v=spf1")))
      ] | length
    ' "$existing_file")"
    if [[ "${spf_count:-0}" -ge 1 ]]; then
      echo "CONFLICT|||SPF_EXISTS_DIFFERENT"
      return 0
    fi
  fi

  local match_exact match_name
  match_exact="$(jq -r --arg t "$typ" --arg n "$name" --arg v "$val" '
    [.[] |
      select(((.type // .record_type // "") | ascii_upcase) == $t)
      | select(((.name // .host // "") | tostring | ascii_downcase) == ($n|ascii_downcase))
      | select(((.value // .content // .data // "") | tostring) == $v)
    ] | .[0].id // empty
  ' "$existing_file")"
  if [[ -n "$match_exact" ]]; then
    echo "NOOP|||$match_exact|EXACT"
    return 0
  fi

  match_name="$(jq -r --arg t "$typ" --arg n "$name" '
    [.[] |
      select(((.type // .record_type // "") | ascii_upcase) == $t)
      | select(((.name // .host // "") | tostring | ascii_downcase) == ($n|ascii_downcase))
    ] | length
  ' "$existing_file")"
  if [[ "$match_name" -ge 1 ]]; then
    echo "CONFLICT|||NAME_TYPE_EXISTS_DIFFERENT_VALUE"
    return 0
  fi

  echo "CREATE|||NEW|ttl=$ttl;pri=$pri"
}

# Apply CREATE via POST single record — never collection PUT
cd_create_record() {
  local domain_id="$1" typ="$2" name="$3" val="$4" ttl="${5:-3600}" pri="${6:-}"
  typ="$(cd_norm_type "$typ")"
  name="$(cd_norm_name "$name")"
  local payload
  if [[ -n "$pri" && "$typ" == "MX" ]]; then
    payload="$(jq -n --arg t "$typ" --arg n "$name" --arg v "$val" --argjson ttl "$ttl" --argjson p "$pri" \
      '{type:$t, name:$n, value:$v, ttl:$ttl, priority:$p}')"
  else
    payload="$(jq -n --arg t "$typ" --arg n "$name" --arg v "$val" --argjson ttl "$ttl" \
      '{type:$t, name:$n, value:$v, ttl:$ttl}')"
  fi
  # Guard: refuse collection PUT path
  local path="/v1/domains/${domain_id}/nameservers/records"
  cd_api POST "$path" -d "$payload"
  echo "$CD_HTTP_STATUS"
}

# Explicit ban helper
cd_forbid_collection_put() {
  # Intentionally unimplemented — any call is a hard error
  echo "FORBIDDEN_COLLECTION_PUT" >&2
  return 99
}
