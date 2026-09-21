$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$executable = Join-Path $PSScriptRoot 'IMAPRemailer.Jobs\bin\Release\net10.0\publish\IMAPRemailer.Jobs.exe'
$logDirectory = Join-Path $PSScriptRoot 'data\logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$logBase = Join-Path $logDirectory "$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
$logFile = "$logBase.log"

$env:DOTNET_ENVIRONMENT = 'Development'
Set-Location $repositoryRoot
& $executable --background 2>&1 | ForEach-Object {
    $_
    $_ | Out-File -FilePath $logFile -Append -Encoding utf8
}
exit $LASTEXITCODE
