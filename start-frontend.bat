@echo off
echo Starting FarmChain AI Frontend...
cd /d "%~dp0frontend"
call npm.cmd run dev -- --host 127.0.0.1
pause
