# Start the upgraded LOCAL SME installation. No migration, db push or seed.
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$runtime = Join-Path $repo '.codex_tmp\runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $runtime '.gitignore'))) { Set-Content -LiteralPath (Join-Path $runtime '.gitignore') -Value '*' }
function Listening($port) { return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) }
function StartHidden($name, $exe, $arguments, $cwd) {
  $process = Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $cwd -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime "$name.out.log") -RedirectStandardError (Join-Path $runtime "$name.err.log") -PassThru
  Write-Host "$name started (PID $($process.Id))"
}
if (-not (Listening 5432)) {
  docker start sme-loan-workflow-db-1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Cannot start the existing SME database. No new database has been created.' }
  for ($i=0; $i -lt 20 -and -not (Listening 5432); $i++) { Start-Sleep -Milliseconds 500 }
}
if (-not (Test-Path -LiteralPath (Join-Path $repo 'backend\dist\main.js'))) { throw 'Backend build missing. Run npm.cmd --prefix backend run build first.' }
if (-not (Listening 8000)) { StartHidden 'ml' (Get-Command python.exe).Source @('-X','utf8','-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') (Join-Path $repo 'ml-service') }
# With no configured SMTP host, the application uses its loopback-only mailbox.
$smtpHostConfigured = [bool](Select-String -LiteralPath (Join-Path $repo 'backend\.env') -Pattern '^\s*SMTP_HOST\s*=\s*[^\s#]+' -Quiet)
if (-not $smtpHostConfigured -and -not (Listening 1025)) { StartHidden 'mailbox' (Get-Command node.exe).Source @('scripts/dev-mailbox.cjs') (Join-Path $repo 'backend') }
if (-not (Listening 3000)) { StartHidden 'backend' (Get-Command node.exe).Source @('--env-file=.env','dist/main.js') (Join-Path $repo 'backend') }
if (-not (Listening 5173)) { StartHidden 'frontend' (Get-Command node.exe).Source @('node_modules/vite/bin/vite.js','--host','0.0.0.0','--port','5173','--strictPort') (Join-Path $repo 'frontend') }
for ($i=0; $i -lt 30; $i++) {
  try { $health = Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 3; if ($health.services.database -eq 'ready') { break } } catch {}
  Start-Sleep -Milliseconds 500
}
if ($health.services.database -ne 'ready') { throw 'SME API/database is not ready. Check the local runtime logs.' }
Write-Host 'Staff: http://localhost:5173/noi-bo'
Write-Host 'Enterprise: http://localhost:5173/portal'
if (-not $smtpHostConfigured) { Write-Host 'Local verification inbox: http://localhost:8025/' }
