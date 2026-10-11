$ErrorActionPreference = 'Stop'
$taskRelease = Invoke-RestMethod 'https://api.github.com/repos/google/go-containerregistry/releases/latest'
$taskAsset = $taskRelease.assets | Where-Object name -eq 'go-containerregistry_Windows_x86_64.tar.gz'
$taskChecksum = $taskRelease.assets | Where-Object name -eq 'checksums.txt'
if (-not $taskAsset -or -not $taskChecksum) { throw 'No se encontró el binario oficial de crane.' }
$taskArchive = Join-Path $PWD '.tools\crane.tar.gz'
Invoke-WebRequest $taskAsset.browser_download_url -OutFile $taskArchive
$taskSums = (Invoke-WebRequest $taskChecksum.browser_download_url).Content
if ($taskSums -is [byte[]]) { $taskSums = [Text.Encoding]::UTF8.GetString($taskSums) }
$taskLine = ($taskSums -split "`n" | Where-Object { $_ -match 'go-containerregistry_Windows_x86_64.tar.gz$' })
if (-not $taskLine -or (Get-FileHash $taskArchive -Algorithm SHA256).Hash -ne ($taskLine -split '\s+')[0]) { throw 'La comprobación SHA256 de crane falló.' }
$taskDir = Join-Path $PWD '.tools\crane'
New-Item -ItemType Directory -Force -Path $taskDir | Out-Null
& tar -xzf $taskArchive -C $taskDir crane.exe
if ($LASTEXITCODE -ne 0) { throw 'No se pudo extraer crane.' }
& (Join-Path $taskDir 'crane.exe') version
