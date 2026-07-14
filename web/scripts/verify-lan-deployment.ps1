#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$webRoot = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $webRoot "backups"
$logRoot = Join-Path $webRoot "logs"
$resultPath = Join-Path $logRoot "lan-deployment-verification.json"

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$task = Get-ScheduledTask -TaskName "Yonye Lead Platform Backup"
$before = Get-ChildItem -LiteralPath $backupRoot -Filter "yonye_leads_*.dump" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

$startedAt = [datetime]::UtcNow
Start-ScheduledTask -TaskName "Yonye Lead Platform Backup"

$deadline = (Get-Date).AddMinutes(2)
do {
    Start-Sleep -Seconds 2
    $task = Get-ScheduledTask -TaskName "Yonye Lead Platform Backup"
} while ($task.State -eq "Running" -and (Get-Date) -lt $deadline)

$taskInfo = Get-ScheduledTaskInfo -TaskName "Yonye Lead Platform Backup"
$after = Get-ChildItem -LiteralPath $backupRoot -Filter "yonye_leads_*.dump" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
$firewallRule = Get-NetFirewallRule -DisplayName "Yonye Lead Platform - Private LAN"
$portFilter = $firewallRule | Get-NetFirewallPortFilter
$addressFilter = $firewallRule | Get-NetFirewallAddressFilter

$backupCreated = $null -ne $after -and
    $after.LastWriteTimeUtc -ge $startedAt.AddSeconds(-5) -and
    ($null -eq $before -or $after.FullName -ne $before.FullName)

$result = [ordered]@{
    checkedAt = (Get-Date).ToString("o")
    taskName = $task.TaskName
    taskState = $task.State.ToString()
    taskRunAs = $task.Principal.UserId
    nextRunTime = $taskInfo.NextRunTime.ToString("o")
    lastTaskResult = $taskInfo.LastTaskResult
    backupCreated = $backupCreated
    backupFile = if ($after) { $after.FullName } else { $null }
    firewallEnabled = $firewallRule.Enabled.ToString()
    firewallProfile = $firewallRule.Profile.ToString()
    firewallAction = $firewallRule.Action.ToString()
    firewallProtocol = $portFilter.Protocol.ToString()
    firewallLocalPort = $portFilter.LocalPort
    firewallRemoteAddress = @($addressFilter.RemoteAddress)
}

$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $resultPath -Encoding UTF8

if ($taskInfo.LastTaskResult -ne 0 -or -not $backupCreated) {
    throw "LAN deployment verification failed. See $resultPath"
}

Write-Output "LAN deployment verification passed."
Write-Output "Result: $resultPath"
