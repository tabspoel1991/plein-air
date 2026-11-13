@echo off
rem Plein Air - rendert de demofilm opnieuw (frame voor frame) naar de map film\
rem Gebruik: render-film.bat          (eindversie: 4K + 1080p + stills, duurt even)
rem          render-film.bat concept  (snelle versie op lage resolutie)
cd /d "%~dp0"
set "PY="
where py >NUL 2>NUL && set "PY=py"
if not defined PY (
  for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do set "PY=%%D\python.exe"
)
if not defined PY (
  echo Python niet gevonden.
  pause
  exit /b 1
)
set "VERSIE=%~1"
if "%VERSIE%"=="" set "VERSIE=final"
"%PY%" tools\render_film.py %VERSIE%
pause
