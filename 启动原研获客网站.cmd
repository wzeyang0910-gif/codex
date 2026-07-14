@echo off
title Yonye Medical Lead Platform
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0web\scripts\start-production.ps1"
echo.
echo The start check has finished. Press any key to close this window.
pause >nul
