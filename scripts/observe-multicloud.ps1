param(
  [switch]$Watch,
  [ValidateRange(1, 15)][int]$Minutes = 6,
  [ValidateRange(5, 60)][int]$IntervalSeconds = 10
)
$ErrorActionPreference = 'Stop'
# Public GET requests only. This observer never stops services or changes data.
$taskSites = [ordered]@{
  app = 'https://app.multicloud.polarisenterprisesv.com'
  aws = 'https://aws.multicloud.polarisenterprisesv.com'
  gcp = 'https://gcp.multicloud.polarisenterprisesv.com'
}
$taskDeadline = [DateTime]::UtcNow.AddMinutes($Minutes)
do {
  foreach ($taskEntry in $taskSites.GetEnumerator()) {
    $taskTimer = [Diagnostics.Stopwatch]::StartNew()
    try {
      $taskResponse = Invoke-WebRequest -Uri ($taskEntry.Value + '/api/health/ready') -UseBasicParsing -DisableKeepAlive -TimeoutSec 8
      $taskBody = $taskResponse.Content | ConvertFrom-Json
      $taskStatus = [int]$taskResponse.StatusCode
      $taskSite = $taskBody.site
      $taskReady = $taskBody.status -eq 'ready'
    } catch {
      $taskStatus = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
      $taskSite = $null
      $taskReady = $false
    }
    $taskTimer.Stop()
    [ordered]@{
      observedAtUtc = [DateTime]::UtcNow.ToString('o')
      endpoint = $taskEntry.Key
      httpStatus = $taskStatus
      site = $taskSite
      ready = $taskReady
      elapsedMs = $taskTimer.ElapsedMilliseconds
    } | ConvertTo-Json -Compress
  }
  if (-not $Watch -or [DateTime]::UtcNow -ge $taskDeadline) { break }
  Start-Sleep -Seconds $IntervalSeconds
} while ([DateTime]::UtcNow -lt $taskDeadline)
