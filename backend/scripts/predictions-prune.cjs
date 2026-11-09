/* Dọn bảng delay_predictions (mỗi lần chấm thêm một dòng nên bảng tăng mỗi ngày).
 *   node scripts/predictions-prune.cjs                xem trước (không xóa gì)
 *   node scripts/predictions-prune.cjs --days 60      đổi số ngày giữ (mặc định 90)
 *   node scripts/predictions-prune.cjs --apply        thực hiện xóa
 *
 * Chính sách giữ (đề xuất 09/11/2026, người phụ trách mô hình chốt):
 *   - luôn giữ dự báo MỚI NHẤT của mỗi hồ sơ theo từng công đoạn (cặp hồ sơ + model_version, vd v4.0-THAM_DINH), vì đó là dự báo đang hiển thị;
 *   - giữ mọi dòng trong N ngày gần nhất (mặc định 90) để xem được xu hướng;
 *   - chỉ xóa các dòng cũ hơn N ngày VÀ không phải dòng mới nhất.
 * Không đổi lược đồ, không đụng bảng nào khác. Dự báo là dữ liệu dẫn xuất, chấm lại được bất cứ lúc nào. Không chạy khi NODE_ENV=production.
 */
const { PrismaClient } = require('@prisma/client');
if (process.env.NODE_ENV === 'production') { console.error('Không chạy trên production.'); process.exit(1); }
const apply = process.argv.includes('--apply');
const di = process.argv.indexOf('--days');
const days = di > 0 ? Number(process.argv[di + 1]) : 90;
if (!Number.isInteger(days) || days < 1) { console.error('--days phải là số nguyên dương.'); process.exit(1); }
const prisma = new PrismaClient();

// Điều kiện "sẽ xóa": cũ hơn N ngày và không phải dòng mới nhất của (hồ sơ, model_version)
const OLD_NOT_LATEST = `
  prediction_timestamp < now() - ($1 || ' days')::interval
  AND id NOT IN (SELECT DISTINCT ON (application_id, model_version) id FROM delay_predictions
                 ORDER BY application_id, model_version, prediction_timestamp DESC, id DESC)`;

async function main() {
  const [{ total }] = await prisma.$queryRawUnsafe('SELECT count(*)::int AS total FROM delay_predictions');
  const [{ doomed }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS doomed FROM delay_predictions WHERE ${OLD_NOT_LATEST}`, String(days));
  const [{ oldest }] = await prisma.$queryRawUnsafe('SELECT min(prediction_timestamp) AS oldest FROM delay_predictions');
  console.log(`Bảng delay_predictions: ${total} dòng${oldest ? `, cũ nhất ${new Date(oldest).toISOString().slice(0, 10)}` : ''}.`);
  console.log(`Chính sách: giữ dự báo mới nhất mỗi hồ sơ theo công đoạn và mọi dòng trong ${days} ngày gần nhất.`);
  console.log(`Sẽ xóa: ${doomed} dòng; giữ lại: ${total - doomed} dòng.`);
  if (!apply) { console.log(doomed ? 'Chưa xóa gì. Thêm --apply để thực hiện.' : 'Không có gì để dọn.'); return; }
  if (!doomed) { console.log('Không có gì để dọn.'); return; }
  const removed = await prisma.$executeRawUnsafe(`DELETE FROM delay_predictions WHERE ${OLD_NOT_LATEST}`, String(days));
  console.log(`Đã xóa ${removed} dòng.`);
}
main().catch(e => { console.error(e.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
