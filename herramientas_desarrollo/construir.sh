#!/bin/sh
# Une las partes de src/ en ../assets/js/app.js (en orden: 01_base … 09_inicio)
# y cambia el «?v=» de los scripts en Made_Rebanadas.html para que el navegador no use una copia vieja
cd "$(dirname "$0")"
cat src/0*.js > ../assets/js/app.js && echo "assets/js/app.js reconstruido"
v=$(date +%Y%m%d%H%M)
sed -i -e "s/\.js?v=[0-9.]*\"/.js?v=$v\"/g" -e "s/\.css?v=[0-9.]*\"/.css?v=$v\"/g" ../Made_Rebanadas.html && echo "scripts y css con ?v=$v"
