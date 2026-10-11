param(
  [Parameter(Mandatory = $true)][string]$ScriptPath,
  [string]$InstanceId = 'i-045241f9bd25d85b2'
)
$ErrorActionPreference = 'Stop'
$env:AWS_CLI_OUTPUT_ENCODING = 'utf-8'
$env:AWS_LOGIN_CACHE_DIRECTORY = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.secrets\aws\login'))
$taskAws = Join-Path $env:LOCALAPPDATA 'Programs\Amazon\AWSCLIV2\aws.exe'
# SSM records command parameters. Only public scripts may pass through this helper.
$taskScript = [IO.Path]::GetFullPath($ScriptPath)
if ($taskScript -match '[\\/]\.secrets[\\/]') { throw 'No enviar secretos en parámetros SSM. Transferirlos por S3 privado.' }
$taskEncoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($taskScript))
$taskRemotePath = '/tmp/polaris-ues-public-' + [Guid]::NewGuid().ToString('N') + '.sh'
$taskCommandText = 'umask 077; printf %s {0} | base64 -d > {1}; bash {1} </dev/null; task_exit=$?; rm -f {1}; exit $task_exit' -f $taskEncoded, $taskRemotePath
$taskParams = @{commands = @($taskCommandText) } | ConvertTo-Json -Compress
$taskParameterPath = Join-Path $PSScriptRoot '..\tmp\aws-ssm-parameters.json'
[IO.File]::WriteAllText($taskParameterPath, $taskParams)
$taskCommon = @('--profile','polaris-ues','--region','us-east-2','--no-cli-pager')
$taskId = & $taskAws ssm send-command --instance-ids $InstanceId --document-name AWS-RunShellScript --parameters "file://$taskParameterPath" --query Command.CommandId --output text @taskCommon
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar la ejecución SSM.' }
Write-Output ('SSM command: ' + $taskId)
for ($taskAttempt = 0; $taskAttempt -lt 120; $taskAttempt++) {
  Start-Sleep -Seconds 5
  $taskRaw = & $taskAws ssm get-command-invocation --command-id $taskId --instance-id $InstanceId --output json @taskCommon 2>$null
  if ($LASTEXITCODE -ne 0) { continue }
  $taskResult = ($taskRaw -join "`n") | ConvertFrom-Json
  if ($taskResult.Status -in @('Pending','InProgress','Delayed')) { continue }
  Write-Output $taskResult.StandardOutputContent
  if ($taskResult.Status -ne 'Success') {
    Write-Output $taskResult.StandardErrorContent
    throw ('SSM finalizó con estado ' + $taskResult.Status)
  }
  exit 0
}
throw 'La ejecución SSM sigue pendiente. Revisar el comando antes de repetirlo.'
