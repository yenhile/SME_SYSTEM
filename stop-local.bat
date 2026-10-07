@echo off
chcp 65001 > nul
title Dung he thong SME Loan Workflow
echo =====================================================================
echo    DANG DUNG CAC DICH VU SME LOAN WORKFLOW LOCAL...
echo =====================================================================
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0stop-local.ps1"
pause
