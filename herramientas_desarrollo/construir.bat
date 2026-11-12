@echo off
rem Une las partes de src\ en ..\assets\js\app.js (en orden: 01_base ... 09_inicio)
cd /d "%~dp0"
copy /b src\0*.js ..\assets\js\app.js >nul && echo assets\js\app.js reconstruido
