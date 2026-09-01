$ErrorActionPreference = 'Stop'
$vectorRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeFile = Join-Path $vectorRoot '.vector-runtime.json'
if (-not (Test-Path -LiteralPath $runtimeFile)) { Write-Host 'Vector is not recorded as running.'; exit 0 }
$record = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
$stopped = 0
foreach ($saved in @($record.processes)) {
  $process = Get-Process -Id ([int]$saved.pid) -ErrorAction SilentlyContinue
  if ($process -and $process.ProcessName -eq $saved.name -and $process.StartTime.ToUniversalTime().Ticks -eq [int64]$saved.startTimeUtcTicks) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    $stopped += 1
  }
}
if ($stopped) { Write-Host "Vector stopped cleanly ($stopped managed processes)." } else { Write-Host 'The recorded Vector processes were already stopped.' }
Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
