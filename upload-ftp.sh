#!/bin/bash

LOCAL_DIR="/Users/noahbez/Desktop/deinTarifheld/out"
FTP_HOST="host275.checkdomain.de"
FTP_USER="thwhvklj"
REMOTE_BASE="/var/www/vhosts/thwhvklj.host275.checkdomain.de/deintarifheld.de"

echo "========================================"
echo "  FTP Upload zu Checkdomain (Fallback)"
echo "========================================"
echo "Host: ${FTP_HOST}"
echo "User: ${FTP_USER}"
echo "Ziel: ${REMOTE_BASE}"
echo ""

if [[ ! -d "${LOCAL_DIR}" ]]; then
  echo "Fehler: Exportordner nicht gefunden: ${LOCAL_DIR}"
  exit 1
fi

read -r -s -p "FTP-Passwort eingeben (unsichtbar): " FTP_PASS
echo ""
if [[ -z "${FTP_PASS}" ]]; then
  echo "Fehler: Leeres Passwort."
  exit 1
fi

# Test-Verbindung zuerst
echo "Teste FTP-Verbindung..."
if ! curl --silent --ftp-pasv --user "${FTP_USER}:${FTP_PASS}" "ftp://${FTP_HOST}/" -l >/dev/null 2>&1; then
  echo "Fehler: FTP-Verbindung fehlgeschlagen. Bitte Passwort pruefen."
  exit 1
fi
echo "Verbindung OK."
echo ""

cd "${LOCAL_DIR}"

TOTAL=0
FAILED=0

while IFS= read -r -d '' file; do
  rel="${file#./}"
  url="ftp://${FTP_HOST}${REMOTE_BASE}/${rel}"
  printf "  %s ... " "${rel}"
  if curl --silent --show-error --ftp-pasv --ftp-create-dirs \
       --user "${FTP_USER}:${FTP_PASS}" -T "${file}" "${url}" 2>&1; then
    echo "OK"
    TOTAL=$((TOTAL + 1))
  else
    echo "FEHLER"
    FAILED=$((FAILED + 1))
  fi
done < <(find . -type f -print0)

echo ""
echo "========================================"
echo "  Fertig: ${TOTAL} Dateien hochgeladen, ${FAILED} Fehler"
echo "========================================"
