@echo off
setlocal
cd /d "%~dp0"

rem If Rata's Vite server is already healthy, start only Electron. The
rem single-instance lock will focus the existing Control Center and exit.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue'; try { $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200 -and $response.Content -like '*Rata Office Assistant*') { exit 0 } } catch {}; exit 1"

if %ERRORLEVEL% EQU 0 (
  echo Rata is already running. Showing the existing window...
  call npm run start
  set "rata_exit=%ERRORLEVEL%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "& '.\scripts\bootstrap-windows.ps1'; exit $LASTEXITCODE"
  set "rata_exit=%ERRORLEVEL%"
)

if not "%rata_exit%"=="0" (
  echo.
  echo Rata failed to start. Review the error above.
  pause
)

exit /b %rata_exit%
