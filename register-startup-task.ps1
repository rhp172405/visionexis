# Registers a Scheduled Task that launches EyeCog automatically at user logon.
# Run this script once (as Administrator is NOT required for a per-user logon trigger).
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$taskName = "EyeCog Auto Start"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\start-all.ps1`""

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Scheduled task '$taskName' registered. EyeCog will start automatically at next logon."
Write-Host "To start it right now without logging off, run: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "To remove it later, run: .\unregister-startup-task.ps1"
