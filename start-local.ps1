# ==============================================================================
# SME LOAN WORKFLOW - LOCAL DEVELOPMENT STARTUP SCRIPT
# ==============================================================================
$ErrorActionPreference = "Continue"
$rootPath = $PSScriptRoot
if (-not $rootPath) { $rootPath = (Get-Location).Path }

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "         SME LOAN WORKFLOW - KHOI DONG HE THONG TAI LOCAL            " -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Kiem tra va khoi dong Docker Desktop
Write-Host "`n[Buoc 1/5] Kiem tra dich vu Docker Engine..." -ForegroundColor Yellow
$dockerOk = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch { $dockerOk = $false }

if (-not $dockerOk) {
    Write-Host "Docker Desktop chua chay. Dang kich hoat Docker Desktop..." -ForegroundColor Magenta
    $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerExe) {
        Start-Process $dockerExe
        Write-Host "Dang cho Docker Desktop khoi dong (khoang 15-30 giay)..." -ForegroundColor Gray
        $timeout = 60
        $count = 0
        while ($count -lt $timeout) {
            Start-Sleep -Seconds 3
            $count += 3
            try {
                $null = docker info 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $dockerOk = $true
                    Write-Host "Docker Engine da san sang!" -ForegroundColor Green
                    break
                }
            } catch {}
            Write-Host -NoNewline "."
        }
        Write-Host ""
    } else {
        Write-Host "Khong tim thay Docker Desktop tai C:\Program Files\Docker\Docker\Docker Desktop.exe" -ForegroundColor Red
        Write-Host "Vui long tu bat Docker Desktop hoac dam bao PostgreSQL dang chay tren port 5432." -ForegroundColor White
    }
} else {
    Write-Host "Docker Engine da san sang!" -ForegroundColor Green
}

# 2. Khoi dong PostgreSQL container
Write-Host "`n[Buoc 2/5] Khoi dong PostgreSQL Database..." -ForegroundColor Yellow
if ($dockerOk) {
    docker compose up -d db
    Write-Host "Dang cho PostgreSQL ket noi on dinh..." -ForegroundColor Gray
    Start-Sleep -Seconds 4
} else {
    Write-Host "Bo qua Docker, dung PostgreSQL local tren cong 5432..." -ForegroundColor Gray
}

# 3. Dong bo Schema va Seed du lieu
Write-Host "`n[Buoc 3/5] Dong bo Schema va Nap du lieu mau (Prisma)..." -ForegroundColor Yellow
Push-Location "$rootPath\backend"
try {
    Write-Host "Dang dong bo Schema vao Database..." -ForegroundColor Gray
    npm run prisma:push
    Write-Host "Dang nap du lieu tai khoan mau (Seed)..." -ForegroundColor Gray
    npm run prisma:seed
    Write-Host "Dong bo Co so du lieu thanh cong!" -ForegroundColor Green
} catch {
    Write-Host "Loi khi dong bo: $_" -ForegroundColor Red
}
Pop-Location

# 4. Khoi chay 3 service trong 3 terminal rieng biet
Write-Host "`n[Buoc 4/5] Khoi chay Backend, ML-Service, Frontend..." -ForegroundColor Yellow

$backendCmd = "Set-Location '$rootPath\backend'; Write-Host '=== SME LOAN BACKEND (Port 3000) ===' -ForegroundColor Green; npm run start:dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

$mlCmd = "Set-Location '$rootPath\ml-service'; Write-Host '=== SME ML-SERVICE (Port 8000) ===' -ForegroundColor Magenta; python -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $mlCmd

$frontendCmd = "Set-Location '$rootPath\frontend'; Write-Host '=== SME FRONTEND (Port 5173) ===' -ForegroundColor Cyan; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "Da khoi chay 3 cua so Terminal cho tung dich vu!" -ForegroundColor Green

# 5. Mo trinh duyet
Write-Host "`n[Buoc 5/5] Mo trinh duyet web..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "              HE THONG DA SAN SANG DE PHAT TRIEN & TEST!             " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "Cac dia chi truy cap:" -ForegroundColor White
Write-Host "  - Frontend Web UI:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  - Backend API:      http://localhost:3000/api" -ForegroundColor Cyan
Write-Host "  - ML-Service Docs:  http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "  - PostgreSQL:       localhost:5432 (DB: sme_loan)" -ForegroundColor Cyan
Write-Host "`nTai khoan dang nhap thu nghiem:" -ForegroundColor White
Write-Host "  1. CBTD:       cbtd_nam     /  Cbtd@123     (Lap & kiem tra ho so)" -ForegroundColor Yellow
Write-Host "  2. Tham quyen: risk_quang   /  Risk@123     (Tham dinh & phe duyet rui ro)" -ForegroundColor Yellow
Write-Host "  3. Quan ly:    manager_dung /  Manager@123  (Theo doi Dashboard & SLA)" -ForegroundColor Yellow
Write-Host "  4. Admin:      admin        /  Admin@123    (Quan tri he thong)" -ForegroundColor Yellow
Write-Host "`n* De dung he thong: Chay .\stop-local.ps1 (hoac click dup stop-local.bat)" -ForegroundColor Gray
