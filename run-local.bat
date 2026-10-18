@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Install Python 3.12 with the Windows Python launcher, then run this file again.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" py -3.12 -m venv .venv
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" -m pip install -r backend\requirements.lock
if errorlevel 1 exit /b 1
if not exist "backend\.env" ".venv\Scripts\python.exe" scripts\setup_local.py
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" scripts\doctor.py --mode local
if errorlevel 1 exit /b 1
echo Checkout remains closed until seller and provider setup is completed.
".venv\Scripts\python.exe" scripts\run_local.py
