@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem AegisAI one-time Windows setup.
rem Installs backend/frontend dependencies and builds/verifies the complete
rem Tier 2 index (147 MiniLM fingerprints).

cd /d "%~dp0"
set "ROOT=%CD%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "PYTHON=%BACKEND%\.venv\Scripts\python.exe"

echo.
echo ============================================
echo AegisAI one-time team setup
echo ============================================

if not exist ".env" (
    echo ERROR: .env is missing.
    echo Copy .env.example to .env, add your local ANTHROPIC_API_KEY and JWT_SECRET,
    echo then run SETUP_AEGISAI.bat again. Secrets are never copied by this script.
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm was not found. Install Node.js LTS and retry.
    exit /b 1
)

if not exist "%PYTHON%" (
    set "PYTHON_BOOTSTRAP="
    where py >nul 2>&1
    if not errorlevel 1 (
        py -3.11 --version >nul 2>&1
        if not errorlevel 1 set "PYTHON_BOOTSTRAP=py -3.11"
    )
    if not defined PYTHON_BOOTSTRAP (
        where python >nul 2>&1
        if not errorlevel 1 (
            python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
            if not errorlevel 1 set "PYTHON_BOOTSTRAP=python"
        )
    )
    if not defined PYTHON_BOOTSTRAP (
        echo ERROR: Python 3.11+ was not found. Install Python 3.11 or newer and retry.
        exit /b 1
    )
    echo Creating backend virtual environment...
    !PYTHON_BOOTSTRAP! -m venv "%BACKEND%\.venv"
    if errorlevel 1 (
        echo ERROR: Could not create the backend virtual environment.
        exit /b 1
    )
)

echo Installing backend dependencies...
call "%PYTHON%" -m pip install --upgrade pip
if errorlevel 1 exit /b 1
call "%PYTHON%" -m pip install -r "%BACKEND%\requirements.txt"
if errorlevel 1 exit /b 1

echo Installing frontend dependencies...
pushd "%FRONTEND%"
call npm install
if errorlevel 1 (
    popd
    exit /b 1
)
echo Verifying frontend production build...
call npm run build
if errorlevel 1 (
    popd
    exit /b 1
)
popd

rem Reuse a project-local MiniLM cache when one is already present. An
rem explicitly configured TIER2_MODEL_PATH always takes precedence.
set "LOCAL_TIER2_MODEL=%BACKEND%\.venv\models\all-MiniLM-L6-v2"
if not defined TIER2_MODEL_PATH if exist "!LOCAL_TIER2_MODEL!\model.safetensors" (
    set "TIER2_MODEL_PATH=!LOCAL_TIER2_MODEL!"
)
if defined TIER2_MODEL_PATH if exist "!TIER2_MODEL_PATH!\model.safetensors" (
    set "TIER2_PREWARM_LOCAL_ONLY=1"
    echo Using local MiniLM model: !TIER2_MODEL_PATH!
)

echo Downloading/caching MiniLM and building all Tier 2 fingerprints...
set "PREWARM_LOG=%TEMP%\aegisai_tier2_prewarm_!RANDOM!.log"
call "%PYTHON%" "scripts\prewarm_tier2.py" >"!PREWARM_LOG!" 2^>^&1
set "PREWARM_EXIT=!errorlevel!"
type "!PREWARM_LOG!"
if not "!PREWARM_EXIT!"=="0" (
    del /q "!PREWARM_LOG!" >nul 2>&1
    echo ERROR: Tier 2 prewarm failed. Check model download access and retry.
    exit /b 1
)
findstr /C:"reference_fingerprints=147" "!PREWARM_LOG!" >nul
if errorlevel 1 (
    del /q "!PREWARM_LOG!" >nul 2>&1
    echo ERROR: Tier 2 prewarm did not load exactly 147 fingerprints.
    exit /b 1
)
del /q "!PREWARM_LOG!" >nul 2>&1

echo.
echo ============================================
echo Setup complete.
echo ============================================
echo Verified: reference_fingerprints=147.
echo Start the application with START.ps1, or run the backend/frontend separately.
echo.
exit /b 0
