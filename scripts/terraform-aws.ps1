param(
  [Parameter(Mandatory = $true)][ValidateSet('init','validate','plan','apply','output')][string]$Action,
  [ValidateSet('aws-only','vpn-only')][string]$Root = 'aws-only'
)
$ErrorActionPreference = 'Stop'
$taskAws = Join-Path $env:LOCALAPPDATA 'Programs\Amazon\AWSCLIV2\aws.exe'
$env:AWS_LOGIN_CACHE_DIRECTORY = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.secrets\aws\login'))
$taskCredentials = & $taskAws configure export-credentials --profile polaris-ues --format process
if ($LASTEXITCODE -ne 0) { throw 'No se pudo obtener la sesión temporal de AWS.' }
$taskCredentials = ($taskCredentials -join "`n") | ConvertFrom-Json
$env:AWS_ACCESS_KEY_ID = $taskCredentials.AccessKeyId
$env:AWS_SECRET_ACCESS_KEY = $taskCredentials.SecretAccessKey
$env:AWS_SESSION_TOKEN = $taskCredentials.SessionToken
$env:AWS_DEFAULT_REGION = 'us-east-2'
$taskCredentials = $null
$taskRoot = '-chdir=infra/terraform/' + $Root
$taskPlanFile = if ($Root -eq 'vpn-only') { 'vpn' } else { 'aws' }
try {
  if ($Root -eq 'vpn-only') {
    $env:GOOGLE_OAUTH_ACCESS_TOKEN = (& gcloud auth print-access-token --account=developerengineer545@gmail.com).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $env:GOOGLE_OAUTH_ACCESS_TOKEN) { throw 'No se pudo autenticar Google Cloud.' }
  }
  if ($Action -in @('plan','apply')) {
    $taskPlan = (& $taskAws freetier get-account-plan-state --region us-east-1 --no-cli-pager --output json) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $taskPlan.accountId -ne '117425831688' -or $taskPlan.accountPlanType -ne 'FREE' -or $taskPlan.accountPlanStatus -ne 'ACTIVE') {
      throw 'Se requiere la cuenta autorizada con plan FREE activo. No se actualizará el plan.'
    }
    if ([decimal]$taskPlan.accountPlanRemainingCredits.amount -lt 15) { throw 'Crédito inferior a USD15: revisar el laboratorio antes de aprovisionar.' }
    Write-Output ('Plan FREE activo; crédito USD' + $taskPlan.accountPlanRemainingCredits.amount)
  }
  switch ($Action) {
    'init' { & terraform $taskRoot init -input=false }
    'validate' { & terraform $taskRoot validate -no-color }
    'plan' { & terraform $taskRoot plan -input=false -no-color "-out=../../../.secrets/$taskPlanFile.plan" }
    'apply' { & terraform $taskRoot apply -input=false -no-color "../../../.secrets/$taskPlanFile.plan" }
    'output' { & terraform $taskRoot output -json }
  }
  $taskExit = $LASTEXITCODE
} finally {
  foreach ($taskKey in @('AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','GOOGLE_OAUTH_ACCESS_TOKEN')) { Remove-Item "Env:$taskKey" -ErrorAction SilentlyContinue }
}
exit $taskExit
