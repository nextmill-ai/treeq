@echo off
REM TreeQ OneDrive safety-check + conditional delete
REM Generated 2026-05-14 by Claude in Cowork mode
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_treeq_safety_check.ps1"
echo.
echo Done. See _treeq_diff_report.txt
timeout /t 3 >nul
