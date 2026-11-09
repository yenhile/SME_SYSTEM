/* Kiểm tra hồ sơ demo đang mở còn "tươi" không (chỉ đọc, không ghi gì).
 *   npm run demo:status
 * Hồ sơ demo được dựng với số giờ đã dùng tính tại lúc chạy seed:demo, sau đó đồng hồ SLA vẫn chạy nên lâu dần hồ sơ thành "Quá hạn".
 * Lệnh này đếm số hồ sơ demo đang mở theo mức SLA và báo khi nên chạy `npm run demo:refresh` trước buổi demo.
 * Cần `npm run build` trước (dùng hàm tính SLA của backend) và DATABASE_URL trỏ đúng DB.
 */
require('reflect-metadata');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { stageSlaSummary } = require(path.resolve(__dirname, '..', 'dist', 'modules/workflow/sla/sla-policy'));
const prisma = new PrismaClient();
const OPEN = ['RECEIVED', 'CHECKED', 'SUPPLEMENT_REQUIRED', 'PENDING_APPRAISAL'];
const STALE_SHARE = 0.5;   // quá nửa số hồ sơ mở đã quá hạn thì coi là cũ

async function main() {
  const loans = await prisma.loanApplication.findMany({
    where: { currentStatus: { in: OPEN }, company: { taxCode: { startsWith: 'DEMO' } } },
    select: { applicationCode: true, currentStage: true, stageHistories: { where: { exitedAt: null }, include: { pauses: true }, take: 1 } },
  });
  if (!loans.length) { console.log('Chưa có hồ sơ demo đang mở. Chạy: npm run demo:refresh'); return; }
  const now = new Date();
  const count = { overdue: 0, warning: 0, ok: 0, waiting: 0, unknown: 0 };
  for (const loan of loans) {
    const open = loan.stageHistories[0];
    if (!open) { count.unknown++; continue; }
    const sla = stageSlaSummary(open, (open.pauses ?? []).map(p => ({ start: p.startedAt, end: p.endedAt })), now);
    if (sla.waitingEnterprise) count.waiting++;
    else if (sla.isOverdue) count.overdue++;
    else if (sla.remainingHours !== null && sla.remainingHours !== undefined && sla.standardHours && sla.remainingHours < sla.standardHours * 0.25) count.warning++;
    else if (sla.error) count.unknown++;
    else count.ok++;
  }
  console.log(`Hồ sơ demo đang mở: ${loans.length}`);
  console.log(`  còn dư giờ: ${count.ok} | sắp hết hạn (còn dưới 25% SLA): ${count.warning} | chờ doanh nghiệp: ${count.waiting} | quá hạn: ${count.overdue} | không tính được: ${count.unknown}`);
  const share = count.overdue / loans.length;
  if (share > STALE_SHARE) console.log(`\nCẢNH BÁO: ${Math.round(share * 100)}% hồ sơ demo đã quá hạn, không còn đủ các mức Bình thường/Chú ý/Khẩn để trình diễn.\nChạy: npm run demo:refresh`);
  else console.log('\nDữ liệu demo còn dùng được.');
}
main().catch(e => { console.error(e.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
