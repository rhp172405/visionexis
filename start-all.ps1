$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Start-Process -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$root\start-backend.ps1`"" `
  -WindowStyle Hidden

Start-Sleep -Seconds 3

Start-Process -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$root\start-frontend.ps1`"" `
  -WindowStyle Hidden

Start-Sleep -Seconds 3

Start-Process "http://localhost:5173"
