@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher missing. Install Python 3.12 from python.org and re-run.
  pause
  exit /b 1
)
py -3.12 scripts\doctor.py --mode local
if errorlevel 1 (
  echo.
  echo First-time setup: run-local.bat will install requirements and create backend\.env.
)
pause
