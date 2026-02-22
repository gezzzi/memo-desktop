@echo off
title Memo Desktop
cd /d "%~dp0"

REM Start the dev server in the background
start /b cmd /c "npm run dev"

REM Wait for the server to be ready
echo Waiting for server to start...
:wait
ping -n 2 127.0.0.1 >nul
curl -s http://localhost:4003 >nul 2>&1
if errorlevel 1 goto wait

echo Server is ready. Opening Memo...

REM Open in Chrome as a normal browser tab
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:4003

echo.
echo Memo Desktop is running.
echo Press any key to stop the server and exit.
pause >nul
taskkill /f /im node.exe >nul 2>&1
