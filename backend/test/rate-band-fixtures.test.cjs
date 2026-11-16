const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SIMULATED_BANDS, SIMULATED_BASIS, SIMULATED_EFFECTIVE_FROM, simulatedBandRows, ensureSimulatedBands, rateInBand, assertActiveBandResponse } = require('../scripts/rate-band-fixtures.cjs');

const NOW = new Date('2026-11-15T03:00:00Z');

test('Khung mô phỏng: đúng số liệu, kỳ hạn để trống, hiệu lực 0 giờ 13/11/2026 giờ Việt Nam', () => {
  assert.deepEqual(SIMULATED_BANDS.map(b => [b.loanType, b.minRate, b.maxRate]), [
    ['VAY_VON_LUU_DONG', 6.5, 10.5], ['VAY_DAU_TU_TSCD', 7.5, 12], ['THAU_CHI', 8, 13],
  ]);
  assert.equal(SIMULATED_EFFECTIVE_FROM.toISOString(), '2026-11-12T17:00:00.000Z');
  assert.match(SIMULATED_BASIS, /^Biểu lãi suất mô phỏng phục vụ nghiên cứu, không phải biểu lãi suất chính thức của ngân hàng\./);
  assert.match(SIMULATED_BASIS, /không thuộc diện khống chế trần lãi suất ưu tiên\.$/);
  assert.ok(SIMULATED_BASIS.length <= 500);
  const rows = simulatedBandRows('fixture');
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.termFromMonths, null); assert.equal(row.termToMonths, null);
    assert.equal(row.basis, SIMULATED_BASIS); assert.equal(row.createdBy, 'fixture');
    assert.equal(row.effectiveFrom.getTime(), SIMULATED_EFFECTIVE_FROM.getTime());
  }
  const early = new Date('2025-12-31T17:00:00.000Z');
  assert.ok(simulatedBandRows('fixture', early).every(r => r.effectiveFrom === early && r.basis === SIMULATED_BASIS));
});

function fakeDb(existing) {
  const rows = existing.map(r => ({ ...r }));
  const created = [];
  const db = {
    interestRateBand: {
      findMany: async () => rows.map(r => ({ ...r })),
      create: async ({ data }) => { const row = { id: 'n' + created.length, createdAt: NOW, ...data }; rows.push(row); created.push(row); return row; },
    },
  };
  // Mọi bảng khác (gồm admin_audit_logs) không được chạm tới.
  return { created, db: new Proxy(db, { get: (t, k) => { if (k in t) return t[k]; throw new Error('Không được truy cập ' + String(k)); } }) };
}

test('ensureSimulatedBands chỉ tạo khung cho loại vay chưa có khung hiệu lực, không ghi nhật ký quản trị', async () => {
  const { db, created } = fakeDb([
    { id: 'a', loanType: 'VAY_VON_LUU_DONG', minRate: '5', maxRate: '9', effectiveFrom: new Date('2026-11-01T00:00:00Z'), termFromMonths: null, termToMonths: null },
    { id: 'b', loanType: 'THAU_CHI', minRate: '8', maxRate: '13', effectiveFrom: new Date('2026-12-01T00:00:00Z'), termFromMonths: null, termToMonths: null },
  ]);
  const result = await ensureSimulatedBands(db, NOW, 'seed-demo');
  assert.deepEqual(created.map(r => r.loanType).sort(), ['THAU_CHI', 'VAY_DAU_TU_TSCD']);
  assert.deepEqual(result.created.sort(), ['THAU_CHI', 'VAY_DAU_TU_TSCD']);
  assert.equal(result.bands.find(b => b.loanType === 'VAY_VON_LUU_DONG').id, 'a', 'khung sẵn có giữ nguyên');
  assert.equal(created[0].createdBy, 'seed-demo');
  const again = await ensureSimulatedBands(db, NOW, 'seed-demo');
  assert.deepEqual(again.created, []);
  assert.equal(created.length, 2);
});

test('rateInBand cho lãi suất trong khung, 2 chữ số thập phân', () => {
  const band = { minRate: '6.5', maxRate: '10.5' };
  for (const r of [0, 0.001, 0.333333, 0.5, 0.999999]) {
    const rate = rateInBand(band, r);
    assert.ok(rate >= 6.5 && rate <= 10.5, String(rate));
    assert.equal(Math.round(rate * 100) / 100, rate);
  }
  assert.equal(rateInBand(band, 0), 6.5);
  assert.equal(rateInBand(band, 0.5), 8.5);
});

test('assertActiveBandResponse dừng với thông báo rõ khi thiếu khung hiệu lực hoặc mức dùng trong script nằm ngoài khung', () => {
  const ok = { status: 200, data: { items: [], active: { VAY_VON_LUU_DONG: { id: 'x', minRate: 6.5, maxRate: 10.5 } } } };
  assert.deepEqual(assertActiveBandResponse(ok, 'VAY_VON_LUU_DONG', 8.5), ok.data.active.VAY_VON_LUU_DONG);
  assert.throws(() => assertActiveBandResponse({ status: 200, data: { items: [], active: { VAY_VON_LUU_DONG: null } } }, 'VAY_VON_LUU_DONG', 8.5),
    /Chưa có khung lãi suất hiệu lực cho Vốn lưu động.*Admin/);
  assert.throws(() => assertActiveBandResponse(ok, 'VAY_VON_LUU_DONG', 11), /11.*ngoài khung 6,5–10,5/);
  assert.throws(() => assertActiveBandResponse({ status: 403, data: { message: 'Forbidden' } }, 'VAY_VON_LUU_DONG', 8.5), /HTTP 403/);
});
