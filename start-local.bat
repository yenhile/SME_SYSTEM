@echo off
chcp 65001 > nul
title Khoi dong SME Loan Workflow (Local Dev)
echo =====================================================================
echo    DANG KHOI DONG HE THONG SME LOAN WORKFLOW TAI LOCAL...
echo =====================================================================
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start-local.ps1"
pause
