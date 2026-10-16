@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Install Python 3.12 before continuing.
  pause
  exit /b 1
)
py -3.12 scripts\build_firebase_preview.py || (pause & exit /b 1)
py -3.12 scripts\doctor.py --mode firebase-preview || (pause & exit /b 1)
echo.
echo Preview generated. It is NOT a functional live shop.
echo To deploy to a Firebase PREVIEW channel ONLY:
echo firebase hosting:channel:deploy glownuture-preview --project glownuture-f157c --config firebase.preview.json
pause
