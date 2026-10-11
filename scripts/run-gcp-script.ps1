param(
  [Parameter(Mandatory=$true)][ValidateSet('polaris-ues-gcp-app','polaris-ues-gcp-mariadb')][string]$Instance,
  [Parameter(Mandatory=$true)][string]$ScriptPath
)
$ErrorActionPreference = 'Stop'
$taskScript = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $ScriptPath)).Replace("`r`n", "`n")
$taskEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($taskScript))
# Only public setup scripts belong here. Transfer secrets with SCP, never command arguments.
$taskRemotePath = '/tmp/polaris-ues-public-' + [Guid]::NewGuid().ToString('N') + '.sh'
# Run a file so docker exec cannot consume the remaining script from stdin.
$taskCommand = 'umask 077; echo {0} | base64 -d > {1}; bash {1} </dev/null; task_exit=$?; rm -f {1}; exit $task_exit' -f $taskEncoded, $taskRemotePath
& gcloud compute ssh $Instance --zone=us-central1-a --project=project-dba46330-c40e-432b-9ad --account=developerengineer545@gmail.com --tunnel-through-iap --quiet "--command=$taskCommand"
exit $LASTEXITCODE
