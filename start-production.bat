@echo off
chcp 65001 > nul
title Khoi dong SME Loan Workflow (Docker Production)
echo =====================================================================
echo    DANG BUILD VA KHOI DONG DOCKER COMPOSE PRODUCTION...
echo =====================================================================
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start-production.ps1"
pause
