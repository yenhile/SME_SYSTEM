const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { parseBandInput, selectActiveBand, assertRateInBand, bandView } = require('../dist/modules/rate-bands/rate-band.logic');
const { AdminService } = require('../dist/admin.service');

const NOW = new Date('2026-11-13T03:00:00Z');
const input = (over = {}) => ({ loanType: 'VAY_VON_LUU_DONG', minRate: 7, maxRate: 12.5, effectiveDate: '2026-11-20', basis: 'Số liệu mô phỏng – không phải biểu lãi suất của ngân hàng', ...over });
const bad = (over, pattern) => assert.throws(() => parseBandInput(input(over), NOW), e => e.getStatus() === 400 && pattern.test(e.message), JSON.stringify(over));

test('Khung mới: ngày tương lai hiệu lực từ 0 giờ Việt Nam, hôm nay hiệu lực ngay, không lùi ngày', () => {
  assert.deepEqual(parseBandInput(input(), NOW), { loanType: 'VAY_VON_LUU_DONG', minRate: 7, maxRate: 12.5, effectiveFrom: new Date('2026-11-19T17:00:00Z'), basis: 'Số liệu mô phỏng – không phải biểu lãi suất của ngân hàng' });
  assert.deepEqual(parseBandInput(input({ effectiveDate: '2026-11-13' }), NOW).effectiveFrom, NOW);
  bad({ effectiveDate: '2026-11-12' }, /không được trước hôm nay/);
  bad({ effectiveDate: '2026-02-30' }, /ngày hợp lệ/);
});

test('Khung mới: sàn lớn hơn 0, sàn không vượt trần, trần tối đa 100, 2 chữ số thập phân, có căn cứ', () => {
  bad({ minRate: 0 }, /Sàn/);
  bad({ minRate: 13 }, /không lớn hơn trần/);
  bad({ maxRate: 100.5 }, /Trần/);
  bad({ minRate: 7.125 }, /Sàn/);
  bad({ basis: '   ' }, /Căn cứ ban hành/);
  bad({ basis: 'x'.repeat(501) }, /Căn cứ ban hành/);
  bad({ loanType: 'VAY_KHAC' }, /Loại vay/);
  assert.equal(parseBandInput(input({ minRate: 9, maxRate: 9 }), NOW).maxRate, 9);
});

test('Khung hiệu lực là phiên bản mới nhất đã tới ngày, đúng loại vay và kỳ hạn', () => {
  const band = (id, loanType, effectiveFrom, extra = {}) => ({ id, loanType, minRate: '7', maxRate: '12', effectiveFrom: new Date(effectiveFrom), createdAt: new Date(effectiveFrom), termFromMonths: null, termToMonths: null, basis: 'b', ...extra });
  const bands = [
    band('old', 'VAY_VON_LUU_DONG', '2026-10-01T00:00:00Z'),
    band('current', 'VAY_VON_LUU_DONG', '2026-11-01T00:00:00Z'),
    band('future', 'VAY_VON_LUU_DONG', '2026-12-01T00:00:00Z'),
    band('other', 'THAU_CHI', '2026-11-05T00:00:00Z'),
    band('long', 'VAY_DAU_TU_TSCD', '2026-11-01T00:00:00Z', { termFromMonths: 13 }),
  ];
  assert.equal(selectActiveBand(bands, { loanType: 'VAY_VON_LUU_DONG', termMonths: 12, at: NOW }).id, 'current');
  assert.equal(selectActiveBand(bands, { loanType: 'VAY_DAU_TU_TSCD', termMonths: 12, at: NOW }), null);
  assert.equal(selectActiveBand(bands, { loanType: 'VAY_DAU_TU_TSCD', termMonths: 36, at: NOW }).id, 'long');
  assert.equal(selectActiveBand(bands, { loanType: 'VAY_VON_LUU_DONG', termMonths: 12, at: new Date('2026-09-01T00:00:00Z') }), null);
});

test('Lãi suất phải nằm trong khung, có thông báo theo loại vay', () => {
  const band = { id: 'b', minRate: '7', maxRate: '12.5', effectiveFrom: new Date('2026-11-01T00:00:00Z'), basis: 'b' };
  assert.doesNotThrow(() => assertRateInBand(7, band, 'VAY_VON_LUU_DONG', 'Lãi suất phê duyệt'));
  assert.doesNotThrow(() => assertRateInBand(12.5, band, 'VAY_VON_LUU_DONG', 'Lãi suất phê duyệt'));
  assert.throws(() => assertRateInBand(12.51, band, 'VAY_VON_LUU_DONG', 'Lãi suất phê duyệt'), e => e.getStatus() === 400 && e.message === 'Lãi suất phê duyệt phải trong khung 7–12,5%/năm của loại vay Vốn lưu động.');
  assert.throws(() => assertRateInBand(8, null, 'THAU_CHI', 'Lãi suất phê duyệt'), e => e.getStatus() === 400 && e.message === 'Chưa có khung lãi suất hiệu lực cho loại vay Thấu chi. Liên hệ Admin cấu hình khung.');
  assert.deepEqual(bandView(band), { id: 'b', minRate: 7, maxRate: 12.5, effectiveFrom: '2026-11-01T00:00:00.000Z', basis: 'b' });
  assert.equal(bandView(null), null);
});

function adminDb(previous = null) {
  const bands = [], logs = [];
  const tx = {
    interestRateBand: {
      findFirst: async () => previous,
      create: async ({ data }) => { const row = { id: 'band-new', createdAt: NOW, ...data }; bands.push(row); return row; },
    },
    user: { findUnique: async () => ({ username: 'khoa.tran', fullName: 'Trần Khoa' }) },
    adminAuditLog: { createMany: async ({ data }) => { logs.push(...data); return { count: data.length }; } },
  };
  return { bands, logs, service: new AdminService({ ...tx, $transaction: async fn => fn(tx) }) };
}

test('Admin thêm phiên bản khung và ghi nhật ký quản trị trong cùng giao dịch', async () => {
  const previous = { id: 'band-old', minRate: '6.5', maxRate: '11', effectiveFrom: new Date('2026-11-01T00:00:00Z'), basis: 'cũ' };
  const { bands, logs, service } = adminDb(previous);
  const created = await service.createRateBand(input(), 'admin-1', NOW);
  assert.equal(created.id, 'band-new');
  assert.equal(bands.length, 1);
  assert.equal(bands[0].createdBy, 'admin-1');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, 'INTEREST_RATE_BAND_CREATED');
  assert.equal(logs[0].targetType, 'INTEREST_RATE_BAND');
  assert.equal(logs[0].targetId, 'band-new');
  assert.equal(logs[0].targetLabel, 'Vốn lưu động');
  assert.deepEqual(logs[0].before, { minRate: 6.5, maxRate: 11, effectiveFrom: '2026-11-01T00:00:00.000Z' });
  assert.deepEqual(logs[0].after, { minRate: 7, maxRate: 12.5, effectiveFrom: '2026-11-19T17:00:00.000Z', basis: 'Số liệu mô phỏng – không phải biểu lãi suất của ngân hàng' });
  const first = adminDb(null);
  await first.service.createRateBand(input(), 'admin-1', NOW);
  assert.equal(first.logs[0].before, undefined);
});

test('Admin nhập sai thì không ghi khung hay nhật ký', async () => {
  const { bands, logs, service } = adminDb();
  await assert.rejects(service.createRateBand(input({ minRate: 20 }), 'admin-1', NOW), e => e.getStatus() === 400);
  assert.equal(bands.length + logs.length, 0);
});
