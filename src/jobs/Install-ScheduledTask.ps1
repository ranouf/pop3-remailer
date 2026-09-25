$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$projectPath = Join-Path $PSScriptRoot 'IMAPRemailer.Jobs\IMAPRemailer.Jobs.csproj'
$trayProjectPath = Join-Path $PSScriptRoot 'IMAPRemailer.Tray\IMAPRemailer.Tray.csproj'
$publishPath = Join-Path $PSScriptRoot 'IMAPRemailer.Jobs\bin\Release\net10.0\publish'
$trayPublishPath = Join-Path $PSScriptRoot 'IMAPRemailer.Tray\bin\Release\net10.0-windows\publish'
$executable = Join-Path $publishPath 'IMAPRemailer.Jobs.exe'
$trayExecutable = Join-Path $trayPublishPath 'IMAPRemailer.Tray.exe'

$legacyTask = Get-ScheduledTask -TaskName 'POP3 Remailer' -ErrorAction SilentlyContinue
if ($legacyTask) {
    Stop-ScheduledTask -TaskName 'POP3 Remailer'
    Unregister-ScheduledTask -TaskName 'POP3 Remailer' -Confirm:$false
}
$existingTask = Get-ScheduledTask -TaskName 'IMAP Remailer' -ErrorAction SilentlyContinue
if ($existingTask) {
    Stop-ScheduledTask -TaskName 'IMAP Remailer'
}
$existingTrayTask = Get-ScheduledTask -TaskName 'IMAP Remailer Tray' -ErrorAction SilentlyContinue
if ($existingTrayTask) {
    Stop-ScheduledTask -TaskName 'IMAP Remailer Tray'
}
Get-Process -Name 'IMAPRemailer.Jobs' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $executable } |
    Stop-Process -Force
Get-Process -Name 'IMAPRemailer.Tray' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $trayExecutable } |
    Stop-Process -Force

dotnet publish $projectPath -c Release -o $publishPath
if ($LASTEXITCODE -ne 0) {
    throw '.NET publish failed.'
}
dotnet publish $trayProjectPath -c Release -o $trayPublishPath
if ($LASTEXITCODE -ne 0) {
    throw '.NET tray publish failed.'
}

$action = New-ScheduledTaskAction `
    -Execute $executable `
    -Argument '--background' `
    -WorkingDirectory $repositoryRoot
$trayAction = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -File `"$(Join-Path $PSScriptRoot 'Run-Tray.ps1')`"" `
    -WorkingDirectory $repositoryRoot
$trigger = New-ScheduledTaskTrigger `
    -AtLogOn `
    -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName 'IMAP Remailer' `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null
Register-ScheduledTask `
    -TaskName 'IMAP Remailer Tray' `
    -Action $trayAction `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Start-ScheduledTask -TaskName 'IMAP Remailer'
Start-ScheduledTask -TaskName 'IMAP Remailer Tray'
Write-Host 'IMAP Remailer task installed: background process, appsettings.json cron schedule and message limit.'
Write-Host 'IMAP Remailer Tray task installed: notification flyout and full history window with live logs.'
