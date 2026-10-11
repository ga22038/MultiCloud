param([Parameter(Mandatory=$true)][ValidateSet('init','validate','plan','apply','output')][string]$Action)
$ErrorActionPreference = 'Stop'
$taskProject = 'project-dba46330-c40e-432b-9ad'
$taskAccount = 'developerengineer545@gmail.com'
$env:GOOGLE_OAUTH_ACCESS_TOKEN = (& gcloud auth print-access-token --account=$taskAccount).Trim()
if ($LASTEXITCODE -ne 0 -or -not $env:GOOGLE_OAUTH_ACCESS_TOKEN) { throw 'No se pudo autenticar Google Cloud.' }
$env:TF_VAR_project_id = $taskProject
$taskRoot = '-chdir=infra/terraform/gcp-only'
try {
  switch ($Action) {
    'init' { & terraform $taskRoot init '-backend-config=bucket=project-dba46330-c40e-432b-9ad-polaris-ues-state' -input=false }
    'validate' { & terraform $taskRoot validate -no-color }
    'plan' { & terraform $taskRoot plan -input=false -no-color '-out=../../../.secrets/gcp.plan' }
    'apply' { & terraform $taskRoot apply -input=false -no-color '../../../.secrets/gcp.plan' }
    'output' { & terraform $taskRoot output -json }
  }
  $taskExit = $LASTEXITCODE
} finally { Remove-Item Env:GOOGLE_OAUTH_ACCESS_TOKEN -ErrorAction SilentlyContinue }
exit $taskExit
