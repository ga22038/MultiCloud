$ErrorActionPreference = 'Stop'
$env:AWS_LOGIN_CACHE_DIRECTORY = Join-Path $PWD '.secrets\aws\login'
$taskAws = Join-Path $env:LOCALAPPDATA 'Programs\Amazon\AWSCLIV2\aws.exe'
$taskCommon = @('--profile','polaris-ues','--region','us-east-2','--no-cli-pager')
$taskPlan = (& $taskAws freetier get-account-plan-state @taskCommon --output json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $taskPlan.accountPlanType -ne 'FREE' -or $taskPlan.accountPlanStatus -ne 'ACTIVE' -or $taskPlan.accountId -ne '117425831688') { throw 'Se requiere la cuenta FREE autorizada.' }
$taskBucket = 'polaris-ues-117425831688-state'
& $taskAws s3api head-bucket --bucket $taskBucket @taskCommon 2>$null
if ($LASTEXITCODE -ne 0) {
  & $taskAws s3api create-bucket --bucket $taskBucket --create-bucket-configuration LocationConstraint=us-east-2 @taskCommon
  if ($LASTEXITCODE -ne 0) { throw 'No se creó el backend.' }
}
& $taskAws s3api put-public-access-block --bucket $taskBucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true @taskCommon
if ($LASTEXITCODE -ne 0) { throw 'No se bloqueó el acceso público.' }
& $taskAws s3api put-bucket-versioning --bucket $taskBucket --versioning-configuration Status=Enabled @taskCommon
if ($LASTEXITCODE -ne 0) { throw 'No se activó el versionado.' }
Write-Output 'Backend S3 privado y versionado listo; S3 cifra los objetos por defecto.'
