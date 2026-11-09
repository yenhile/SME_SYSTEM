/* Dọn bộ tài khoản nội bộ về bộ gọn cho chi nhánh nhỏ: 1 Admin, 1 Quản lý, 3 CBTD, 2 Thẩm quyền.
 *   node scripts/accounts-tidy.cjs            xem trước (không ghi)
 *   node scripts/accounts-tidy.cjs --apply    khóa tài khoản thừa (isActive=false), giao lại hồ sơ đang mở
 *   node scripts/accounts-tidy.cjs --unlock-test  mở lại 4 tài khoản test_* để chạy kiểm thử tự động
 * Không xóa tài khoản: giữ khóa ngoại với lịch sử hồ sơ. Không chạy khi NODE_ENV=production.
 */
const { PrismaClient } = require('@prisma/client');
if (process.env.NODE_ENV === 'production') { console.error('Không chạy trên production.'); process.exit(1); }
const KEEP = ['khoa.tran', 'nhung.nguyen', 'ha.le', 'huy.vu', 'nam.hoang', 'mai.bui', 'thanh.ngo'];
const TEST = ['test_admin', 'test_cbtd', 'test_tham_quyen', 'test_quan_ly'];
const OPEN = ['RECEIVED', 'CHECKED', 'SUPPLEMENT_REQUIRED', 'PENDING_APPRAISAL'];
const CBTD_KEEP = ['nam.hoang', 'mai.bui', 'thanh.ngo'];
const prisma = new PrismaClient();

async function main() {
  if (process.argv.includes('--unlock-test')) {
    const r = await prisma.user.updateMany({ where: { username: { in: TEST } }, data: { isActive: true } });
    console.log(`Đã mở lại ${r.count} tài khoản test_*.`); return;
  }
  const apply = process.argv.includes('--apply');
  const present = await prisma.user.findMany({ select: { id: true, username: true, isActive: true, roles: { select: { role: { select: { code: true } } } } } });
  const keepUsers = present.filter(u => KEEP.includes(u.username));
  const missing = KEEP.filter(k => !keepUsers.some(u => u.username === k));
  if (missing.length) { console.error('Thiếu tài khoản cần giữ: ' + missing.join(', ') + '. Chạy seed:demo trước.'); process.exit(1); }
  const lock = present.filter(u => u.isActive && !KEEP.includes(u.username));
  console.log('Sẽ khóa:', lock.map(u => u.username).join(', ') || '(không)');
  const cbtdIds = keepUsers.filter(u => CBTD_KEEP.includes(u.username)).map(u => u.id);
  const orphan = await prisma.loanApplication.findMany({ where: { currentStatus: { in: OPEN }, assignedTo: { in: lock.map(u => u.id) } }, select: { id: true, applicationCode: true, currentStage: true, assignedTo: true } });
  console.log(`Hồ sơ đang mở đang giao cho tài khoản sẽ bị khóa: ${orphan.length}`);
  if (!apply) { console.log('Chưa ghi gì. Thêm --apply để thực hiện.'); return; }
  let i = 0;
  for (const loan of orphan) {
    // Chỉ CBTD giữ hồ sơ Tiếp nhận; hồ sơ Thẩm định giữ nguyên người phụ trách là CBTD đã lập tờ trình nên cũng giao cho CBTD còn lại.
    await prisma.loanApplication.update({ where: { id: loan.id }, data: { assignedTo: cbtdIds[i++ % cbtdIds.length] } });
  }
  const r = await prisma.user.updateMany({ where: { id: { in: lock.map(u => u.id) } }, data: { isActive: false } });
  console.log(`Đã khóa ${r.count} tài khoản, giao lại ${orphan.length} hồ sơ.`);
}
main().catch(e => { console.error(e.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
