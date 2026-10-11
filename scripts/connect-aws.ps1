param([ValidateSet('Login','Identity','Plan')][string]$Action = 'Login')
$ErrorActionPreference = 'Stop'
$taskAwsCommand = Get-Command aws -ErrorAction SilentlyContinue
$taskAws = if ($taskAwsCommand) { $taskAwsCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Programs\Amazon\AWSCLIV2\aws.exe' }
if (-not (Test-Path -LiteralPath $taskAws)) { throw 'Instala AWS CLI v2 antes de conectar la cuenta.' }
# Keep temporary AWS login credentials inside the ignored private directory.
$taskCache = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.secrets\aws\login'))
New-Item -ItemType Directory -Force -Path $taskCache | Out-Null
$env:AWS_LOGIN_CACHE_DIRECTORY = $taskCache
if ($Action -eq 'Login') {
  & $taskAws configure set region us-east-2 --profile polaris-ues
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & $taskAws login --profile polaris-ues --region us-east-2
} elseif ($Action -eq 'Plan') {
  & $taskAws freetier get-account-plan-state --profile polaris-ues --region us-east-1 --no-cli-pager
} else {
  & $taskAws sts get-caller-identity --profile polaris-ues --region us-east-2 --no-cli-pager
}
exit $LASTEXITCODE
