<#
.SYNOPSIS
    Starts the PromptShield backend (FastAPI/uvicorn) and frontend (Vite) together for local dev.

.DESCRIPTION
    - Ensures backend/.env exists (created from .env.example with a local SQLite DATABASE_URL
      if missing) so the backend can boot without a Postgres instance.
    - Runs "alembic upgrade head" so the local SQLite DB has the latest schema.
    - Runs "npm install" for the frontend if node_modules is missing.
    - Launches backend (uvicorn, :8000) and frontend (vite, :3000) each in their own new
      PowerShell window so their logs stay visible and closing a window stops that service.

.PARAMETER SkipInstall
    Skip the "npm install" / migration checks and just launch both servers.
#>

param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendEnv = Join-Path $BackendDir ".env"
$EnvExample = Join-Path $RepoRoot ".env.example"

Write-Host "PromptShield - starting backend + frontend" -ForegroundColor Cyan

# --- 1. Backend .env (local SQLite dev default if missing) ------------------
if (-not (Test-Path $BackendEnv)) {
    Write-Host "backend/.env not found - creating a local dev default from .env.example" -ForegroundColor Yellow
    if (-not (Test-Path $EnvExample)) {
        throw ".env.example not found at repo root; cannot bootstrap backend/.env"
    }
    $envContent = Get-Content $EnvExample -Raw
    $envContent = $envContent -replace `
        'DATABASE_URL=postgresql\+asyncpg://[^\r\n]*', `
        "DATABASE_URL=sqlite+aiosqlite:///./promptshield.db"
    Set-Content -Path $BackendEnv -Value $envContent -Encoding utf8
    Write-Host "Created backend/.env with a local SQLite DATABASE_URL." -ForegroundColor Yellow
    Write-Host "Edit backend/.env to add a real ANTHROPIC_API_KEY for Tier 3 / the mock agent." -ForegroundColor Yellow
}

# --- 2. Python deps + migrations ---------------------------------------------
if (-not $SkipInstall) {
    Write-Host "Applying Alembic migrations..." -ForegroundColor Cyan
    Push-Location $BackendDir
    try {
        python -m alembic upgrade head
    } catch {
        Write-Host "Alembic upgrade failed. Check that backend Python deps are installed (pip install -r backend/requirements.txt)." -ForegroundColor Red
        throw
    } finally {
        Pop-Location
    }
}

# --- 3. Frontend deps ---------------------------------------------------------
$FrontendNodeModules = Join-Path $FrontendDir "node_modules"
if (-not $SkipInstall -and -not (Test-Path $FrontendNodeModules)) {
    Write-Host "Installing frontend dependencies (npm install)..." -ForegroundColor Cyan
    Push-Location $FrontendDir
    try {
        npm install
    } finally {
        Pop-Location
    }
}

# --- 4. Launch backend + frontend, each in their own window ------------------
Write-Host "Launching backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
$backendProcess = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$BackendDir'; python -m uvicorn promptshield.main:app --reload --host 127.0.0.1 --port 8000"
) -PassThru -WindowStyle Normal

Write-Host "Launching frontend on http://localhost:3000 ..." -ForegroundColor Green
$frontendProcess = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$FrontendDir'; npm run dev"
) -PassThru -WindowStyle Normal

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8000  (health check: http://127.0.0.1:8000/health)" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Both services are running in their own PowerShell windows (PIDs: backend=$($backendProcess.Id), frontend=$($frontendProcess.Id))." -ForegroundColor Cyan
Write-Host "Close either window, or press Ctrl+C here, to stop both." -ForegroundColor Cyan

# --- 5. Keep this script alive; stop both (incl. their child processes, e.g.
#        uvicorn/node under each PowerShell window) as soon as either exits ---
try {
    while (-not $backendProcess.HasExited -and -not $frontendProcess.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "Stopping backend and frontend..." -ForegroundColor Yellow
    foreach ($p in @($backendProcess, $frontendProcess)) {
        if ($p -and -not $p.HasExited) {
            & taskkill /PID $p.Id /T /F 2>$null | Out-Null
        }
    }
}
