/* Khung lãi suất mô phỏng cho dữ liệu demo và schema kiểm thử tạm, cùng bước kiểm tra khung trước khi script chạy trên hệ thống thật.
 * Số liệu là biểu mô phỏng phục vụ nghiên cứu, áp cho khoản vay VND thông thường; kỳ hạn để trống nghĩa là áp mọi kỳ hạn.
 */
// 0 giờ ngày 13/11/2026 giờ Việt Nam.
const SIMULATED_EFFECTIVE_FROM = new Date('2026-11-12T17:00:00.000Z');
const SIMULATED_BANDS = [
  {
    loanType: 'VAY_VON_LUU_DONG', minRate: 6.5, maxRate: 10.5,
    basis: 'Số liệu mô phỏng cho khóa luận, không phải biểu lãi suất của ngân hàng. Khoản vay VND thông thường, không thuộc diện trần ưu tiên. Đối chiếu ngày 17/11/2026: NHNN công bố lãi suất cho vay VND bình quân tháng 9/2026 là 8,4–10,9%/năm; Agribank tháng 10/2026 cho vay ngắn hạn thông thường từ 6,1%/năm, bình quân phát sinh 8,45%/năm. Sàn 6,5% cao hơn mức thấp nhất thị trường, trần 10,5% gần mức bình quân cao nhất.',
  },
  {
    loanType: 'VAY_DAU_TU_TSCD', minRate: 7.5, maxRate: 12,
    basis: 'Số liệu mô phỏng cho khóa luận, không phải biểu lãi suất của ngân hàng. Khoản vay VND thông thường, trung dài hạn. Đối chiếu ngày 17/11/2026: Agribank tháng 10/2026 cho vay trung dài hạn từ 7,8%/năm; NHNN công bố bình quân tháng 9/2026 là 8,4–10,9%/năm. Khung cao hơn vốn lưu động 1–1,5 điểm % do kỳ hạn dài hơn.',
  },
  {
    loanType: 'THAU_CHI', minRate: 8, maxRate: 13,
    basis: 'Số liệu mô phỏng cho khóa luận, là giả định vì chưa có biểu thấu chi doanh nghiệp công bố. Khoản vay VND thông thường. Đặt cao hơn vốn lưu động 1,5–2,5 điểm % do hạn mức rút linh hoạt, thường không tài sản bảo đảm. Đối chiếu ngày 17/11/2026 với bình quân NHNN tháng 9/2026: 8,4–10,9%/năm.',
  },
];
const LABELS = { VAY_VON_LUU_DONG: 'Vốn lưu động', VAY_DAU_TU_TSCD: 'Đầu tư tài sản cố định', THAU_CHI: 'Thấu chi' };
const percent = (value) => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

function simulatedBandRows(createdBy, effectiveFrom = SIMULATED_EFFECTIVE_FROM) {
  return SIMULATED_BANDS.map(b => ({ ...b, termFromMonths: null, termToMonths: null, effectiveFrom, createdBy }));
}

/** Tạo khung mô phỏng cho loại vay chưa có khung nào đã tới ngày hiệu lực; loại vay đã có khung giữ nguyên. Không ghi nhật ký quản trị. */
async function ensureSimulatedBands(db, now, createdBy) {
  const rows = await db.interestRateBand.findMany();
  const created = [];
  for (const row of simulatedBandRows(createdBy)) {
    if (rows.some(b => b.loanType === row.loanType && b.effectiveFrom <= now)) continue;
    rows.push(await db.interestRateBand.create({ data: row }));
    created.push(row.loanType);
  }
  return { created, bands: rows };
}

/** Lãi suất trong khung [sàn, trần] theo r ∈ [0, 1), làm tròn 2 chữ số thập phân. */
function rateInBand(band, r) {
  const min = Math.round(Number(band.minRate) * 100), max = Math.round(Number(band.maxRate) * 100);
  return Math.min(max, min + Math.round((max - min) * r)) / 100;
}

/** Kiểm tra phản hồi GET /admin/interest-rate-bands: loại vay có khung hiệu lực và chứa mức lãi suất script sẽ dùng. */
function assertActiveBandResponse(res, loanType, rate) {
  const label = LABELS[loanType] || loanType;
  if (res.status < 200 || res.status >= 300) throw new Error(`Không đọc được khung lãi suất (GET /admin/interest-rate-bands: HTTP ${res.status} ${JSON.stringify(res.data?.message ?? res.data)}).`);
  const band = res.data?.active?.[loanType];
  if (!band) throw new Error(`Chưa có khung lãi suất hiệu lực cho ${label}; tờ trình và phê duyệt sẽ bị từ chối. Admin cấu hình khung ở màn Khung lãi suất rồi chạy lại.`);
  if (rate < Number(band.minRate) || rate > Number(band.maxRate)) throw new Error(`Lãi suất ${percent(rate)}%/năm script dùng nằm ngoài khung ${percent(band.minRate)}–${percent(band.maxRate)}%/năm của ${label}.`);
  return band;
}

module.exports = { SIMULATED_BANDS, SIMULATED_EFFECTIVE_FROM, simulatedBandRows, ensureSimulatedBands, rateInBand, assertActiveBandResponse };
