#!/bin/bash
cd /Users/noahbez/Desktop/deinTarifheld
echo "Starting build at $(date)"
node_modules/.bin/next build
echo "Build done: $? at $(date)"
ls out/ | head -5
