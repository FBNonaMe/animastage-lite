@echo off
cd /d "%~dp0"
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8000"
echo Starting AnimaStage Standalone from port %PORT%...
echo If this port is busy, the launcher will select the next free port.
node serve.mjs %PORT%
if errorlevel 1 pause
