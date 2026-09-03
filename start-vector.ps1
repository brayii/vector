param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$vectorRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$presenceRoot = Join-Path $vectorRoot 'presence'
$runtimeFile = Join-Path $vectorRoot '.vector-runtime.json'
$vectorUrl = 'http://localhost:3000/'
$agentUrl = 'http://127.0.0.1:4317/health'

function Test-VectorReady {
  try {
    $response = Invoke-WebRequest -Uri $vectorUrl -UseBasicParsing -TimeoutSec 2
    $agent = Invoke-WebRequest -Uri $agentUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $agent.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Stop-RecordedVector {
  if (-not (Test-Path -LiteralPath $runtimeFile)) { return }
  try {
    $record = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
    foreach ($saved in @($record.processes)) {
      $process = Get-Process -Id ([int]$saved.pid) -ErrorAction SilentlyContinue
      if ($process -and $process.ProcessName -eq $saved.name -and $process.StartTime.ToUniversalTime().Ticks -eq [int64]$saved.startTimeUtcTicks) {
        & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
      }
    }
  } finally { Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue }
}

if (-not (Test-VectorReady)) {
  Stop-RecordedVector
  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  $vinextCli = Join-Path $presenceRoot 'node_modules\vinext\dist\cli.js'
  if (-not (Test-Path -LiteralPath $vinextCli)) {
    $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
    Write-Host 'Preparing Vector for first launch...'
    & $npmPath ci --prefix $presenceRoot
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $vinextCli)) { throw 'Vector could not restore his locked application dependencies.' }
  }
  $runtimeScript = Join-Path $vectorRoot 'scripts\vector-runtime.cjs'
  $server = Start-Process -FilePath $nodePath -ArgumentList @($runtimeScript) -WorkingDirectory $vectorRoot -WindowStyle Hidden -PassThru
  @{ processes = @(@{ pid = $server.Id; name = $server.ProcessName; startTimeUtcTicks = $server.StartTime.ToUniversalTime().Ticks }); startedAt = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $runtimeFile -Encoding utf8
  $ready = $false
  foreach ($attempt in 1..120) {
    Start-Sleep -Milliseconds 500
    if (Test-VectorReady) { $ready = $true; break }
    if ($server.HasExited) { break }
  }
  if (-not $ready) { Stop-RecordedVector; throw 'Vector did not become ready at http://localhost:3000/.' }
}

if (-not $NoBrowser) { Start-Process $vectorUrl }
