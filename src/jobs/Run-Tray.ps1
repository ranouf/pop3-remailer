$ErrorActionPreference = 'Stop'

$jobSettingsDirectory = Join-Path $PSScriptRoot 'IMAPRemailer.Jobs\bin\Release\net10.0\publish'
$trayExecutable = Join-Path $PSScriptRoot 'IMAPRemailer.Tray\bin\Release\net10.0-windows\publish\IMAPRemailer.Tray.exe'

$env:DOTNET_ENVIRONMENT = 'Development'
$process = Start-Process `
    -FilePath $trayExecutable `
    -ArgumentList "`"$jobSettingsDirectory`"" `
    -PassThru `
    -Wait `
    -WindowStyle Hidden
exit $process.ExitCode
