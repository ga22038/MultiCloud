[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$Region = 'us-east-2',
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$AwsArguments
)
$ErrorActionPreference = 'Stop'
$env:AWS_CLI_OUTPUT_ENCODING = 'utf-8'
$taskCommand = Get-Command aws -ErrorAction SilentlyContinue
$taskAws = if ($taskCommand) { $taskCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Programs\Amazon\AWSCLIV2\aws.exe' }
if (-not (Test-Path -LiteralPath $taskAws)) { throw 'Instala AWS CLI v2 antes de conectar la cuenta.' }
$env:AWS_LOGIN_CACHE_DIRECTORY = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.secrets\aws\login'))
& $taskAws @AwsArguments --profile polaris-ues --region $Region --no-cli-pager
exit $LASTEXITCODE
