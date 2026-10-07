# ==============================================================================
# SME LOAN WORKFLOW - LOCAL DEVELOPMENT STOP SCRIPT
# ==============================================================================

Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host "         SME LOAN WORKFLOW - DUNG CAC DICH VU LOCAL                  " -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Yellow

# 1. Dung container Database
Write-Host "`n[1/2] Dung container PostgreSQL Database..." -ForegroundColor Yellow
try {
    docker compose stop db
    Write-Host "Da dung container PostgreSQL an toan (giu nguyen du lieu)." -ForegroundColor Green
} catch {
    Write-Host "Khong the gui lenh toi Docker. Bo qua." -ForegroundColor Gray
}

# 2. Giai phong cac cong 3000, 5173, 8000
Write-Host "`n[2/2] Giai phong cac tien trinh chiem cong 3000, 5173, 8000..." -ForegroundColor Yellow
$ports = @(3000, 5173, 8000)
foreach ($port in $ports) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $pidToKill = $conn.OwningProcess
                if ($pidToKill -gt 0) {
                    $procName = (Get-Process -Id $pidToKill -ErrorAction SilentlyContinue).ProcessName
                    Write-Host "Dang tat tien trinh PID $pidToKill ($procName) tren cong $port..." -ForegroundColor Gray
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                }
            }
            Write-Host "Da giai phong cong $port thanh cong!" -ForegroundColor Green
        } else {
            Write-Host "Cong $port da sach (khong bi chiem dung)." -ForegroundColor Gray
        }
    } catch {}
}

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "               DA DUNG TOAN BO HE THONG THANH CONG!                  " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
