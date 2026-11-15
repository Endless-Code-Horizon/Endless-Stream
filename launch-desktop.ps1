$serverRunning = $false
try {
  $res = Invoke-RestMethod -Uri "http://localhost:5173/p2p-health" -TimeoutSec 2 -ErrorAction SilentlyContinue
  if ($res.status -eq "online") { $serverRunning = $true }
} catch {}

if (-not $serverRunning) {
  Write-Host "Starting backend engine..."
  Start-Process -FilePath "C:\Program Files\nodejs\node.exe" -ArgumentList "node_modules/vite/bin/vite.js --host" -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

$electronExe = "node_modules\electron\dist\electron.exe"
if (Test-Path $electronExe) {
  Write-Host "Launching Electron Desktop Shell..."
  Start-Process -FilePath $electronExe -ArgumentList "electron\main.cjs"
  exit 0
}

$edgeExe = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (Test-Path $edgeExe) {
  Write-Host "Launching Windows Native Standalone Desktop App..."
  Start-Process -FilePath $edgeExe -ArgumentList "--app=http://localhost:5173 --window-size=1440,900 --enable-features=PlatformHEVCDecoderSupport"
  exit 0
}

$chromeExe = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (Test-Path $chromeExe) {
  Write-Host "Launching Standalone App Mode..."
  Start-Process -FilePath $chromeExe -ArgumentList "--app=http://localhost:5173 --window-size=1440,900"
  exit 0
}

Start-Process "http://localhost:5173"
