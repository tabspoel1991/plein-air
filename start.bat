@echo off
rem Start Plein Air lokaal en open de browser.
cd /d "%~dp0"
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (
  for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do set "PY=%%D\python.exe"
)
if not defined PY (
  echo Python niet gevonden. Installeer Python 3 via python.org en probeer opnieuw.
  pause
  exit /b 1
)
start "" "http://localhost:8000/"
"%PY%" server.py 8000
