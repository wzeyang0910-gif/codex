$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class YonyePowerState
{
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint executionState);
}
"@

$webRoot = Split-Path -Parent $PSScriptRoot
$logRoot = Join-Path $webRoot "logs"
$npm = Join-Path $env:ProgramFiles "nodejs\npm.cmd"

if (-not (Test-Path -LiteralPath $npm)) {
    throw "npm.cmd was not found at $npm"
}

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
Set-Location -LiteralPath $webRoot

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logPath = Join-Path $logRoot "server_$timestamp.log"
$computerName = [System.Net.Dns]::GetHostName()
$lanAddresses = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
    Where-Object {
        $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        -not [System.Net.IPAddress]::IsLoopback($_)
    }

try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -TimeoutSec 2
}
catch {
    $health = $null
}

if ($health.status -eq "ok" -and $health.database -eq "ok") {
    Write-Host "The Yonye Medical lead platform is already running."
    Write-Host "Local access: http://127.0.0.1:3000"
    Write-Host "LAN access:   http://$($computerName):3000"
    foreach ($address in $lanAddresses) {
        Write-Host "LAN access:   http://$($address.IPAddressToString):3000"
    }
    exit 0
}

Write-Host "Starting the Yonye Medical lead platform..."
Write-Host "Local access: http://127.0.0.1:3000"
Write-Host "LAN access:   http://$($computerName):3000"
foreach ($address in $lanAddresses) {
    Write-Host "LAN access:   http://$($address.IPAddressToString):3000"
}
Write-Host "Press Ctrl+C or close this window to stop the website."
Write-Host "Automatic sleep is disabled while this window is running."
Write-Host ""

$continuous = [uint32]::Parse("80000000", [System.Globalization.NumberStyles]::HexNumber)
$systemRequired = [uint32]0x00000001
[YonyePowerState]::SetThreadExecutionState($continuous -bor $systemRequired) | Out-Null

try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $npm run start -- --port 3000 2>&1 | Tee-Object -FilePath $logPath -Append
    $exitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousErrorActionPreference
    [YonyePowerState]::SetThreadExecutionState($continuous) | Out-Null
}

if ($exitCode -ne 0) {
    Write-Host "The website stopped with exit code $exitCode. See $logPath"
}

exit $exitCode
