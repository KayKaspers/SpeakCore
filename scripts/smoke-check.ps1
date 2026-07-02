<#
  SpeakCore Suite – Smoke-Check (NDF Step 031)
  Nicht-destruktiv: nur Build/Test/Validate + optionale read-only Agent-GETs.
  Führt KEINE Docker-Writes, KEIN Provisioning, KEIN rm/start/stop/run aus.

  Nutzung (aus dem Repo oder beliebig):
    pwsh scripts/smoke-check.ps1                 # validate + lint + typecheck + test + build
    pwsh scripts/smoke-check.ps1 -Install        # zusätzlich pnpm install
    pwsh scripts/smoke-check.ps1 -Migrate        # zusätzlich prisma migrate deploy (schreibt nur die DB)
    pwsh scripts/smoke-check.ps1 -Agent http://localhost:4000 -Token <bearer>   # read-only Agent-GETs
#>
param(
  [switch]$Install,
  [switch]$Migrate,
  [string]$Agent = "",
  [string]$Token = ""
)

$ErrorActionPreference = "Stop"
# Frische PATH (Machine + User) – vermeidet stale PATH in nicht-interaktiven Shells.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$env:DATABASE_URL = "file:./dev.db"

$results = [ordered]@{}
function Step([string]$name, [scriptblock]$body) {
  Write-Host "== $name ==" -ForegroundColor Cyan
  try { & $body; $results[$name] = if ($LASTEXITCODE -in @($null, 0)) { "OK" } else { "FAIL($LASTEXITCODE)" } }
  catch { $results[$name] = "ERROR"; Write-Host $_.Exception.Message -ForegroundColor Red }
}

if ($Install) { Step "pnpm install" { pnpm.cmd install } }
Step "prisma validate" { pnpm.cmd --dir apps/web exec prisma validate }
if ($Migrate) { Step "prisma migrate deploy" { pnpm.cmd --dir apps/web exec prisma migrate deploy } }
Step "lint" { pnpm.cmd lint }
Step "typecheck" { pnpm.cmd typecheck }
Step "test" { pnpm.cmd test }
Step "build" { pnpm.cmd build }

# Optional: read-only Agent-Endpunkte (nur GET, keine Writes).
if ($Agent -ne "") {
  $headers = @{}
  if ($Token -ne "") { $headers["authorization"] = "Bearer $Token" }
  Step "agent /health" { Invoke-RestMethod -Method Get -Uri "$Agent/health" | Out-Null }
  Step "agent /version" { Invoke-RestMethod -Method Get -Uri "$Agent/version" | Out-Null }
  Step "agent /system/snapshot" { Invoke-RestMethod -Method Get -Uri "$Agent/system/snapshot" -Headers $headers | Out-Null }
  Step "agent /docker/inventory" { Invoke-RestMethod -Method Get -Uri "$Agent/docker/inventory" -Headers $headers | Out-Null }
}

Write-Host ""
Write-Host "===== Smoke-Check Ergebnis =====" -ForegroundColor Yellow
$results.GetEnumerator() | ForEach-Object { Write-Host ("{0,-28} {1}" -f $_.Key, $_.Value) }
if ($results.Values -contains "FAIL" -or ($results.Values | Where-Object { $_ -like "FAIL*" -or $_ -eq "ERROR" })) {
  Write-Host "Smoke-Check: FEHLGESCHLAGEN" -ForegroundColor Red
  exit 1
}
Write-Host "Smoke-Check: OK" -ForegroundColor Green
