@echo off
title Shadow Learning Bot
cd /d "%~dp0"

:loop
node index.js
echo Bot stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
