@echo off
cd /d "%~dp0"
echo.
echo   Starting local server for the 360 studio ...
echo   Close this window to stop the server.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8788 -Open "studio.html"
echo.
echo Server stopped.
pause

