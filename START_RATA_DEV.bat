@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\scripts\bootstrap-windows.ps1"
