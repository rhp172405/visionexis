$ErrorActionPreference = "Stop"
Unregister-ScheduledTask -TaskName "EyeCog Auto Start" -Confirm:$false
Write-Host "Scheduled task 'EyeCog Auto Start' removed."
