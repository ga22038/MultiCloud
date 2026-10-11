$ErrorActionPreference = 'Stop'
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) { throw 'Docker no esta en PATH. Abre Docker Desktop y una terminal nueva.' }
$process = Start-Process -FilePath $docker.Source -ArgumentList 'info','--format','{{.ServerVersion}}' -PassThru -WindowStyle Hidden
if (-not $process.WaitForExit(15000)) {
  $process.Kill()
  throw 'Docker no responde. Revisa el estado de Docker Desktop y WSL2.'
}
if ($process.ExitCode -ne 0) { throw 'El motor Docker no esta disponible.' }
