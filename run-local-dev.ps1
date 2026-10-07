# ==============================================================================
# SCRIPT HỖ TRỢ KHỞI ĐỘNG LOCAL DEVELOPMENT (SME LOAN WORKFLOW)
# Cách dùng: Mở PowerShell tại thư mục gốc và chạy: .\run-local-dev.ps1
# ==============================================================================

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  SME LOAN WORKFLOW - LOCAL DEVELOPMENT SETUP" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Kiểm tra Docker & Khởi động Database Container
Write-Host "`n[1/4] Kiểm tra PostgreSQL Database..." -ForegroundColor Yellow
$dockerStatus = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "LƯU Ý: Docker Desktop chưa bật hoặc chưa sẵn sàng." -ForegroundColor Red
    Write-Host "Hãy bật Docker Desktop rồi chạy lại script, hoặc đảm bảo PostgreSQL đang chạy trên cổng 5432." -ForegroundColor White
} else {
    Write-Host "Đang khởi động container PostgreSQL..." -ForegroundColor Green
    docker compose up -d db
}

# 2. Đồng bộ Prisma Schema & Seed Dữ liệu
Write-Host "`n[2/4] Kiểm tra & Đồng bộ Cơ sở dữ liệu qua Prisma..." -ForegroundColor Yellow
Push-Location backend
npm run prisma:push
Write-Host "Nạp dữ liệu mẫu (Seed 4 Actors & SLA Workflow)..." -ForegroundColor Green
npm run prisma:seed
Pop-Location

Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host "  HOÀN TẤT CHUẨN BỊ MÔI TRƯỜNG LOCAL!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "Bây giờ bạn mở 3 cửa sổ Terminal để chạy song song 3 dịch vụ:" -ForegroundColor White
Write-Host "  1. Backend:    cd backend    -> npm run start:dev" -ForegroundColor Cyan
Write-Host "  2. ML-Service: cd ml-service -> python -m uvicorn app.main:app --reload --port 8000" -ForegroundColor Cyan
Write-Host "  3. Frontend:   cd frontend   -> npm run dev" -ForegroundColor Cyan
Write-Host "`nTruy cập hệ thống tại: http://localhost:5173" -ForegroundColor Yellow
