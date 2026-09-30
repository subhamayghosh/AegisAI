@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem AegisAI one-time Windows setup.
rem Installs backend/frontend dependencies and builds the complete Tier 2 index.

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

where py >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python Launcher ^(py^) was not found. Install Python 3.11+ and retry.
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm was not found. Install Node.js LTS and retry.
    exit /b 1
)

if not exist "%PYTHON%" (
    echo Creating backend virtual environment...
    py -3.11 -m venv "%BACKEND%\.venv"
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

echo Downloading/caching MiniLM and building all Tier 2 fingerprints...
call "%PYTHON%" "scripts\prewarm_tier2.py"
if errorlevel 1 (
    echo ERROR: Tier 2 prewarm failed. Check model download access and retry.
    exit /b 1
)

echo.
echo ============================================
echo Setup complete.
echo ============================================
echo The output above should report reference_fingerprints=147.
echo Start the application with START.ps1, or run the backend/frontend separately.
echo.
exit /b 0
