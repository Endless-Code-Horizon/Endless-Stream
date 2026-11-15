@echo off
title Endless Stream Desktop Launcher

curl -s http://localhost:5173/p2p-health >nul 2>&1
if %errorlevel% neq 0 (
  start /min "" "C:\Program Files\nodejs\node.exe" node_modules\vite\bin\vite.js --host
  timeout /t 2 /nobreak >nul
)

if exist "node_modules\electron\dist\electron.exe" (
  start "" "node_modules\electron\dist\electron.exe" electron\main.cjs
  exit /b 0
)

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:5173" --window-size=1440,900 --enable-features=PlatformHEVCDecoderSupport
  exit /b 0
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:5173" --window-size=1440,900
  exit /b 0
)

start http://localhost:5173
exit /b 0
