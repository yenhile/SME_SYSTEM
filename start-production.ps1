# ==============================================================================
# SME LOAN WORKFLOW - SCRIPT KHOI CHAY DOCKER COMPOSE PRODUCTION
# ==============================================================================

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "     SME LOAN WORKFLOW - KHOI DONG CHE DO DOCKER PRODUCTION          " -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Kiem tra Docker
$null = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Desktop chua chay! Dang khoi dong Docker Desktop..." -ForegroundColor Magenta
    $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerExe) { Start-Process $dockerExe }
    Write-Host "Vui long cho Docker Desktop mo xong roi chay lai script nay." -ForegroundColor Red
    exit 1
}

# 2. Build & Up toan bo he thong
Write-Host "`nDang build va khoi dong 4 container (db, ml-service, backend, frontend)..." -ForegroundColor Yellow
docker compose up --build -d

Write-Host "`nDang cho cac dich vu san sang..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "             HE THONG DOCKER PRODUCTION DA KHOI CHAY!                " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "Cac dia chi truy cap:" -ForegroundColor White
Write-Host "  - Frontend (Nginx Container):   http://localhost:5173" -ForegroundColor Cyan
Write-Host "  - Backend API (Map cong host):  http://localhost:3001/api" -ForegroundColor Cyan
Write-Host "  - ML-Service:                   http://localhost:8000" -ForegroundColor Cyan
Write-Host "  - PostgreSQL:                   localhost:5432" -ForegroundColor Cyan
Write-Host "`nDe tat he thong Docker: docker compose down" -ForegroundColor Gray
