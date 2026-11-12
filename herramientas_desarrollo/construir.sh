#!/bin/sh
# Une las partes de src/ en ../assets/js/app.js (en orden: 01_base … 09_inicio)
cd "$(dirname "$0")"
cat src/0*.js > ../assets/js/app.js && echo "assets/js/app.js reconstruido"
