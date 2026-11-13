import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const load = async path => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};
const bands = await load('../src/rateBands.ts');
const form = (over = {}) => ({ loanType: 'VAY_VON_LUU_DONG', minRate: '7', maxRate: '12,5', effectiveDate: '2026-11-20', basis: 'Số liệu mô phỏng', ...over });
const TODAY = '2026-11-13';

test('ngày hôm nay theo giờ Việt Nam', () => {
  assert.equal(bands.vnToday(new Date('2026-11-13T16:59:00Z')), '2026-11-13');
  assert.equal(bands.vnToday(new Date('2026-11-13T17:00:00Z')), '2026-11-14');
});

test('form khung báo lỗi trước khi gửi, khớp quy tắc backend', () => {
  assert.equal(bands.bandFormError(form(), TODAY), null);
  assert.equal(bands.bandFormError(form({ loanType: '' }), TODAY), 'Chọn loại vay.');
  assert.equal(bands.bandFormError(form({ minRate: '0' }), TODAY), 'Sàn phải lớn hơn 0 và tối đa 100%/năm, tối đa 2 chữ số thập phân.');
  assert.equal(bands.bandFormError(form({ maxRate: '100,5' }), TODAY), 'Trần phải từ 0 đến 100%/năm, tối đa 2 chữ số thập phân.');
  assert.equal(bands.bandFormError(form({ minRate: '13' }), TODAY), 'Sàn phải không lớn hơn trần.');
  assert.equal(bands.bandFormError(form({ effectiveDate: '2026-11-12' }), TODAY), 'Ngày hiệu lực không được trước hôm nay.');
  assert.equal(bands.bandFormError(form({ effectiveDate: '' }), TODAY), 'Chọn ngày hiệu lực.');
  assert.equal(bands.bandFormError(form({ basis: '  ' }), TODAY), 'Nhập căn cứ ban hành.');
});

test('dữ liệu gửi đi là số và chuỗi đã chuẩn hóa', () => {
  assert.deepEqual(bands.bandPayload(form({ basis: '  Số liệu mô phỏng ' })), { loanType: 'VAY_VON_LUU_DONG', minRate: 7, maxRate: 12.5, effectiveDate: '2026-11-20', basis: 'Số liệu mô phỏng' });
});

test('câu xác nhận nêu khung cũ, khung mới và ngày hiệu lực', () => {
  const current = { id: 'a', minRate: 6.5, maxRate: 11, effectiveFrom: '2026-10-31T17:00:00.000Z', basis: 'x' };
  assert.equal(bands.bandConfirmText(form(), current, TODAY), 'Thêm khung Vốn lưu động 7–12,5%/năm, hiệu lực từ 20/11/2026?\nKhung đang áp dụng: 6,5–11%/năm. Phiên bản đã lưu không sửa hay xóa được.');
  assert.equal(bands.bandConfirmText(form({ effectiveDate: TODAY }), null, TODAY), 'Thêm khung Vốn lưu động 7–12,5%/năm, hiệu lực ngay khi lưu?\nLoại vay này chưa có khung đang áp dụng. Phiên bản đã lưu không sửa hay xóa được.');
});

test('màn khung lãi suất gọi đúng API và nằm trong menu Admin', async () => {
  const view = await readFile(new URL('../src/components/InterestRateBandsView.tsx', import.meta.url), 'utf8');
  assert.match(view, /\/admin\/interest-rate-bands/);
  assert.match(view, /bandConfirmText/);
  assert.match(view, /window\.confirm/);
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /activeTab === 'rates' && <InterestRateBandsView \/>/);
});

test('form tờ trình và form phê duyệt hiện khung đang hiệu lực', async () => {
  const panel = await readFile(new URL('../src/components/AppraisalDecisionPanel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /band\?: RateBandView \| null/);
  assert.match(panel, /bandText/);
  const editor = await readFile(new URL('../src/components/OfficerReportEditor.tsx', import.meta.url), 'utf8');
  assert.match(editor, /rateBand/);
  const result = await readFile(new URL('../src/components/DecisionResult.tsx', import.meta.url), 'utf8');
  assert.match(result, /Khung áp dụng/);
});
