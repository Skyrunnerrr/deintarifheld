#!/bin/bash
echo "========================================="
echo "  deintarifheld.de Upload zu Checkdomain"
echo "========================================="
echo ""

cd /Users/noahbez/Desktop/deinTarifheld/out

echo "Verbinde mit host275.checkdomain.de..."
echo "Gib dein Checkdomain-Passwort ein (du siehst nichts beim Tippen):"
echo ""

sftp -P 22 thwhvklj@host275.checkdomain.de << 'SFTP_DONE'
cd /var/www/vhosts/thwhvklj.host275.checkdomain.de/deintarifheld.de
put .htaccess
put favicon.ico
put robots.txt
put sitemap.xml
put index.html
put 404.html
put datenschutz.html
put impressum.html
put unternehmen.html
put karriere.html
put rechner.html
put index.txt
put datenschutz.txt
put impressum.txt
put unternehmen.txt
mkdir _next
cd _next
mkdir static
cd static
mkdir css
cd css
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/css/bee993eb98d6f8b2.css
cd ..
mkdir media
cd media
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/media/98848575513c9742-s.woff2
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/media/7b0b24f36b1a6d0b-s.p.woff2
cd ..
mkdir chunks
cd chunks
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/chunks/*.js
mkdir app
cd app
mkdir datenschutz
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/chunks/app/datenschutz/page-350bb557ece7dc04.js datenschutz/page-350bb557ece7dc04.js
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/chunks/app/layout-8f7128554cb56059.js
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/chunks/app/page-70dbcb4f52eb671a.js
mkdir impressum
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/chunks/app/impressum/page-38909893f98bc914.js impressum/page-38909893f98bc914.js
mkdir unternehmen
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/chunks/app/unternehmen/layout-08fc5485a84c6a79.js unternehmen/layout-08fc5485a84c6a79.js
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/chunks/app/unternehmen/page-412d789aa6c70ab8.js unternehmen/page-412d789aa6c70ab8.js
mkdir _not-found
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/chunks/app/_not-found/page-589d6ca171f2ec28.js _not-found/page-589d6ca171f2ec28.js
cd ..
mkdir pages
cd pages
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/chunks/pages/*.js
cd ../..
mkdir fcF0QaxIU6H50fbapXuH8
cd fcF0QaxIU6H50fbapXuH8
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/fcF0QaxIU6H50fbapXuH8/_ssgManifest.js
put /Users/noahbez/Desktop/deinTarifheld/out/_next/static/fcF0QaxIU6H50fbapXuH8/_buildManifest.js
cd /var/www/vhosts/thwhvklj.host275.checkdomain.de/deintarifheld.de/_next
mkdir fcF0QaxIU6H50fbapXuH8
cd fcF0QaxIU6H50fbapXuH8
cd /var/www/vhosts/thwhvklj.host275.checkdomain.de/deintarifheld.de
mkdir images
cd images
put /Users/noahbez/Desktop/deinTarifheld/out/images/*
bye
SFTP_DONE

echo ""
echo "Upload abgeschlossen!"
