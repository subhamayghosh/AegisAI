<#
.SYNOPSIS
    Starts the PromptShield backend (FastAPI/uvicorn) and frontend (Vite) together for local dev.

.DESCRIPTION
    - Ensures backend/.env exists (copied from the root .env when available, with a local
      SQLite DATABASE_URL) so the backend can boot without a Postgres instance while retaining
      local API/model settings.
    - Runs "alembic upgrade head" and seeds the local demo accounts.
    - Runs "npm install" for the frontend if node_modules is missing.
    - Launches backend (uvicorn, :8000) and frontend (Vite, :3000) as child processes.
    - Stops both services and removes only local, regenerable development caches when this
      PowerShell session is stopped (Ctrl+C or a normal window close).

.PARAMETER SkipInstall
    Skip the "npm install" / migration checks and just launch both servers.

.PARAMETER ResetAdminPassword
    Reset admin@promptshield.dev to SEED_ADMIN_PASSWORD from backend/.env.

.PARAMETER SyncBackendEnv
    Rebuild backend/.env from the root .env while retaining the local SQLite override.
#>

param(
    [switch]$SkipInstall,
    [switch]$ResetAdminPassword,
    [switch]$SyncBackendEnv
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$RepoRoot = $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendEnv = Join-Path $BackendDir ".env"
$RootEnv = Join-Path $RepoRoot ".env"
$EnvExample = Join-Path $RepoRoot ".env.example"
$Python = Join-Path $BackendDir ".venv\Scripts\python.exe"

function Remove-PromptShieldDevCache {
    <# Remove only regenerable caches inside this repository. #>
    $cacheTargets = @(
        (Join-Path $BackendDir ".pytest_cache"),
        (Join-Path $FrontendDir "node_modules\.vite"),
        (Join-Path $FrontendDir "node_modules\.cache")
    )

    foreach ($cacheTarget in $cacheTargets) {
        if (-not (Test-Path -LiteralPath $cacheTarget)) {
            continue
        }

        $resolvedTarget = (Resolve-Path -LiteralPath $cacheTarget).Path
        if (-not $resolvedTarget.StartsWith($RepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove a cache outside this repository: $resolvedTarget"
        }

        Write-Host "Removing development cache: $resolvedTarget" -ForegroundColor DarkGray
        Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
    }
}

Write-Host "PromptShield - starting backend + frontend" -ForegroundColor Cyan

# --- 1. Backend .env (local SQLite dev default if missing) ------------------
if ($SyncBackendEnv -or -not (Test-Path $BackendEnv)) {
    $envSource = if (Test-Path $RootEnv) { $RootEnv } else { $EnvExample }
    if (-not (Test-Path $envSource)) {
        throw "Neither .env nor .env.example was found at repo root; cannot bootstrap backend/.env"
    }
    $sourceDescription = if ($envSource -eq $RootEnv) { "root .env" } else { ".env.example" }
    Write-Host "Creating backend/.env from $sourceDescription with a local SQLite override" -ForegroundColor Yellow
    $envContent = Get-Content $envSource -Raw
    $envContent = $envContent -replace `
        'DATABASE_URL=postgresql\+asyncpg://[^\r\n]*', `
        "DATABASE_URL=sqlite+aiosqlite:///./promptshield.db"
    Set-Content -Path $BackendEnv -Value $envContent -Encoding utf8
    Write-Host "Created backend/.env with a local SQLite DATABASE_URL." -ForegroundColor Yellow
}

# --- 2. Python deps, migrations, and local demo accounts ---------------------
if (-not (Test-Path -LiteralPath $Python)) {
    throw "Python virtual environment not found at backend/.venv. Run: cd backend; python -m venv .venv; .venv\\Scripts\\pip install -r requirements.txt"
}

if (-not $SkipInstall) {
    Write-Host "Applying Alembic migrations..." -ForegroundColor Cyan
    Push-Location $BackendDir
    try {
        & $Python -m alembic upgrade head
    } catch {
        Write-Host "Alembic upgrade failed. Check that backend Python deps are installed (pip install -r backend/requirements.txt)." -ForegroundColor Red
        throw
    } finally {
        Pop-Location
    }
}

Write-Host "Seeding local demo accounts..." -ForegroundColor Cyan
Push-Location $BackendDir
try {
    $seedArgs = @("..\scripts\seed_db.py")
    if ($ResetAdminPassword) {
        $seedArgs += "--reset-admin-password"
    }
    & $Python @seedArgs
} finally {
    Pop-Location
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

# --- 4. Launch backend + frontend as hidden child processes ------------------
Write-Host "Launching backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
$backendProcess = Start-Process -FilePath $Python -ArgumentList @(
    "-m", "uvicorn", "--app-dir", "src", "promptshield.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"
) -WorkingDirectory $BackendDir -PassThru -WindowStyle Hidden

Write-Host "Launching frontend on http://localhost:3000 ..." -ForegroundColor Green
$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$frontendProcess = Start-Process -FilePath $npmCommand -ArgumentList @(
    "run", "dev", "--", "--host", "127.0.0.1", "--port", "3000"
) -WorkingDirectory $FrontendDir -PassThru -WindowStyle Hidden

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8000  (health check: http://127.0.0.1:8000/health)" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Both services are running (PIDs: backend=$($backendProcess.Id), frontend=$($frontendProcess.Id))." -ForegroundColor Cyan
Write-Host "Press Ctrl+C or close this PowerShell window to stop services and remove local development caches." -ForegroundColor Cyan

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
    Remove-PromptShieldDevCache
}
