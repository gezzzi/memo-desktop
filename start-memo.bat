@echo off
title Memo
cd /d "%~dp0"

REM Prevent duplicate launch
curl -s -o nul -w "" http://localhost:4003 >nul 2>&1
if not errorlevel 1 (
    echo Server is already running. Opening browser...
    start "" http://localhost:4003
    exit /b
)

REM Start the server in the background
start /b cmd /c "npm run dev"

REM Wait for the server to be ready
echo Waiting for server to start...
:wait
ping -n 2 127.0.0.1 >nul
curl -s -o nul -w "" http://localhost:4003 >nul 2>&1
if errorlevel 1 goto wait

echo Server is ready. Opening Memo...

REM Open in default browser via URL handler (ensures foreground activation)
start "" http://localhost:4003

echo.
echo Memo Desktop is running.
echo Press any key to stop the server and exit.
pause >nul
taskkill /f /im node.exe >nul 2>&1
