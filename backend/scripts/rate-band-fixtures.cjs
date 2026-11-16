/* Khung lãi suất mô phỏng cho dữ liệu demo và schema kiểm thử tạm, cùng bước kiểm tra khung trước khi script chạy trên hệ thống thật.
 * Số liệu là biểu mô phỏng phục vụ nghiên cứu, áp cho khoản vay VND thông thường; kỳ hạn để trống nghĩa là áp mọi kỳ hạn.
 */
const SIMULATED_BASIS = 'Biểu lãi suất mô phỏng phục vụ nghiên cứu, không phải biểu lãi suất chính thức của ngân hàng. Tham khảo chương trình tín dụng SME của Vietcombank, Agribank, BIDV và thông tin lãi suất NHNN; tra cứu ngày 13/11/2026. Áp dụng cho khoản vay VND thông thường, không thuộc diện khống chế trần lãi suất ưu tiên.';
// 0 giờ ngày 13/11/2026 giờ Việt Nam.
const SIMULATED_EFFECTIVE_FROM = new Date('2026-11-12T17:00:00.000Z');
const SIMULATED_BANDS = [
  { loanType: 'VAY_VON_LUU_DONG', minRate: 6.5, maxRate: 10.5 },
  { loanType: 'VAY_DAU_TU_TSCD', minRate: 7.5, maxRate: 12 },
  { loanType: 'THAU_CHI', minRate: 8, maxRate: 13 },
];
const LABELS = { VAY_VON_LUU_DONG: 'Vốn lưu động', VAY_DAU_TU_TSCD: 'Đầu tư tài sản cố định', THAU_CHI: 'Thấu chi' };
const percent = (value) => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

function simulatedBandRows(createdBy, effectiveFrom = SIMULATED_EFFECTIVE_FROM) {
  return SIMULATED_BANDS.map(b => ({ ...b, termFromMonths: null, termToMonths: null, effectiveFrom, basis: SIMULATED_BASIS, createdBy }));
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

module.exports = { SIMULATED_BANDS, SIMULATED_BASIS, SIMULATED_EFFECTIVE_FROM, simulatedBandRows, ensureSimulatedBands, rateInBand, assertActiveBandResponse };
