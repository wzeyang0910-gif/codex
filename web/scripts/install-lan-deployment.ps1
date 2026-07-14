#Requires -RunAsAdministrator

[CmdletBinding()]
param(
    [ValidateRange(1, 23)]
    [int]$BackupHour = 2
)

$ErrorActionPreference = "Stop"

$webRoot = Split-Path -Parent $PSScriptRoot
$npm = Join-Path $env:ProgramFiles "nodejs\npm.cmd"

if (-not (Test-Path -LiteralPath $npm)) {
    throw "npm.cmd was not found at $npm"
}

$backupAction = New-ScheduledTaskAction `
    -Execute $npm `
    -Argument "run db:backup" `
    -WorkingDirectory $webRoot
$backupTrigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($BackupHour))
$backupPrincipal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest
$backupSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
    -TaskName "Yonye Lead Platform Backup" `
    -Description "Create a daily backup of the Yonye Medical lead platform database." `
    -Action $backupAction `
    -Trigger $backupTrigger `
    -Principal $backupPrincipal `
    -Settings $backupSettings `
    -Force | Out-Null

$firewallRuleName = "Yonye Lead Platform - Private LAN"
Remove-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
New-NetFirewallRule `
    -DisplayName $firewallRuleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 3000 `
    -Profile Private `
    -RemoteAddress LocalSubnet | Out-Null

Write-Output "Installed scheduled task: Yonye Lead Platform Backup (daily at $($BackupHour.ToString('00')):00)"
Write-Output "Installed private-LAN firewall rule for TCP port 3000"
Write-Output "The website remains manual-start only; no startup task was installed."
