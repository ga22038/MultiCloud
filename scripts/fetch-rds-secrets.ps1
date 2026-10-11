$ErrorActionPreference = 'Stop'
$env:AWS_LOGIN_CACHE_DIRECTORY = Join-Path $PWD '.secrets\aws\login'
$taskAws = Join-Path $env:LOCALAPPDATA 'Programs\Amazon\AWSCLIV2\aws.exe'
$taskCommon = @('--profile','polaris-ues','--region','us-east-2','--no-cli-pager')
$taskDb = (& $taskAws rds describe-db-instances --db-instance-identifier polaris-ues-primary @taskCommon --output json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'No se encontró RDS.' }
$taskDb = $taskDb.DBInstances[0]
if (-not $taskDb.Endpoint.Address -or -not $taskDb.MasterUserSecret.SecretArn) { throw 'RDS aún no tiene endpoint o secreto.' }
$taskSecret = (& $taskAws secretsmanager get-secret-value --secret-id $taskDb.MasterUserSecret.SecretArn @taskCommon --output json) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'No se obtuvo el secreto RDS.' }
[IO.File]::WriteAllText((Join-Path $PWD '.secrets/aws/rds-master.json'), $taskSecret.SecretString)
[IO.File]::WriteAllText((Join-Path $PWD '.secrets/aws/connection.json'), (@{host=$taskDb.Endpoint.Address} | ConvertTo-Json))
$taskSecret = $null
Write-Output ('RDS: ' + $taskDb.DBInstanceStatus + '; endpoint guardado; credenciales ocultas.')
