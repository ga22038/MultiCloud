$ErrorActionPreference = 'Stop'
$env:AWS_LOGIN_CACHE_DIRECTORY = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.secrets\aws\login'))
$taskAws = Join-Path $env:LOCALAPPDATA 'Programs\Amazon\AWSCLIV2\aws.exe'
$taskCrane = Join-Path $PSScriptRoot '..\.tools\crane\crane.exe'
if (-not (Test-Path $taskCrane)) { throw 'Se requiere crane instalado y verificado en .tools/crane.' }
$taskAuthDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.secrets\aws\registry-auth'))
New-Item -ItemType Directory -Force -Path $taskAuthDir | Out-Null
$env:DOCKER_CONFIG = $taskAuthDir
try {
  $taskGoogleToken = (& gcloud auth print-access-token --account=developerengineer545@gmail.com).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'No se obtuvo acceso a Artifact Registry.' }
  $taskAwsToken = (& $taskAws ecr get-login-password --profile polaris-ues --region us-east-2).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'No se obtuvo acceso a ECR.' }
  $taskAuth = @{auths = @{
    'us-central1-docker.pkg.dev' = @{auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('oauth2accesstoken:' + $taskGoogleToken))}
    '117425831688.dkr.ecr.us-east-2.amazonaws.com' = @{auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('AWS:' + $taskAwsToken))}
  }} | ConvertTo-Json -Depth 6
  [IO.File]::WriteAllText((Join-Path $taskAuthDir 'config.json'), $taskAuth)
  $taskAuth = $taskGoogleToken = $taskAwsToken = $null
  $taskSource = 'us-central1-docker.pkg.dev/project-dba46330-c40e-432b-9ad/polaris-ues'
  $taskTarget = '117425831688.dkr.ecr.us-east-2.amazonaws.com/polaris-ues'
  & $taskCrane copy "$taskSource/app@sha256:67575219d882bdde53959fadf7d3e09b1c14bd7e761bf2efb6492e482e393c08" "${taskTarget}:web-c3cfbeb"
  if ($LASTEXITCODE -ne 0) { throw 'No se copió la imagen web.' }
  & $taskCrane copy "$taskSource/migrate@sha256:e4700c21e3631848b9cd841bf554f3b14296290d5c4e5653ea64d43f074196a5" "${taskTarget}:migrate-c3cfbeb"
  if ($LASTEXITCODE -ne 0) { throw 'No se copió la imagen de migración.' }
} finally {
  Remove-Item -LiteralPath (Join-Path $taskAuthDir 'config.json') -ErrorAction SilentlyContinue
  Remove-Item Env:DOCKER_CONFIG -ErrorAction SilentlyContinue
}
