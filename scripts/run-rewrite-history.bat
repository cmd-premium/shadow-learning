@echo off
cd /d "%~dp0.."
set SCRIPT_PATH=%~dp0rewrite-env-history.js
git filter-branch -f --tree-filter "node \"%SCRIPT_PATH%\"" -- --all
echo Done. If no errors above, run: git push --force origin master
pause
