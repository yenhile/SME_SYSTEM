import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/taxCheck.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const module = { exports: {} };
new Function('module', 'exports', outputText)(module, module.exports);
const { describeTaxCheck } = module.exports;

const rulesSource = await readFile(new URL('../src/components/loanInputRules.ts', import.meta.url), 'utf8');
const rulesModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(rulesSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(rulesModule, rulesModule.exports);
const { taxCodeError, documentFormat, officialAmountError, documentTypeName } = rulesModule.exports;

test('a supplement document shows its catalog name, never its code', () => {
  const config = { groups: [{ documentTypes: [{ code: 'A_CHARTER', name: 'Điều lệ' }] }] };
  assert.equal(documentTypeName(config, 'A_CHARTER'), 'Điều lệ');
  assert.equal(documentTypeName(config, 'A · A_CHARTER'), 'Điều lệ');
  assert.equal(documentTypeName(config, 'A_UNKNOWN'), 'Tài liệu bổ sung');
  assert.equal(documentTypeName(null, 'A_CHARTER'), 'Tài liệu bổ sung');
});

test('the creation form cannot submit an amount above 10 billion', async () => {
  const form = await readFile(new URL('../src/components/CreateLoanModal.tsx', import.meta.url), 'utf8');
  assert.match(form, /disabled=\{submitting \|\| taxBlocked \|\| isExceedBranchLimit\}/);
});

test('the official limit stays above zero, within 10 billion and within the proposed amount', () => {
  assert.equal(officialAmountError(3500000000, 4000000000), null);
  assert.equal(officialAmountError(4000000000, '4000000000'), null);
  assert.equal(officialAmountError(10000000000, 15000000000), null);
  assert.match(officialAmountError(0, 4000000000), /lớn hơn 0/);
  assert.match(officialAmountError(10000000001, 15000000000), /10 tỷ/);
  assert.match(officialAmountError(4000000001, 4000000000), /số tiền đề xuất/);
});

test('a tax code must have 10 or 13 digits before it reaches the server', () => {
  for (const good of ['0312345678', '0312345678001', ' 0312345678 ']) assert.equal(taxCodeError(good), null, good);
  for (const bad of ['123', 'abc', '03123456789', '']) assert.match(taxCodeError(bad), /10 hoặc 13 chữ số/, bad);
});

test('the file picker offers only the formats each document type accepts', () => {
  assert.equal(documentFormat('PHAP_LY').accept, '.pdf');
  assert.equal(documentFormat('KHAC').accept, '.pdf');
  assert.equal(documentFormat('TAI_CHINH').accept, '.pdf,.xlsx');
  assert.equal(documentFormat('DU_NO').accept, '.pdf,.xlsx');
  assert.equal(documentFormat('TSBD').accept, '.pdf,.jpg,.jpeg,.png');
});

test('a known company prefills the form', () => {
  const company = { companyName: 'ABC' };
  const result = describeTaxCheck({ found: true, company });
  assert.equal(result.company, company);
  assert.equal(result.type, 'success');
  assert.equal(result.blocked, false);
  assert.match(result.text, /Đã tìm thấy/);
});

test('an unknown tax code is a new company', () => {
  const result = describeTaxCheck({ found: false, company: null });
  assert.equal(result.company, null);
  assert.equal(result.type, 'success');
  assert.equal(result.blocked, false);
  assert.match(result.text, /Doanh nghiệp mới/);
});

test('a restricted company is not prefilled and the user is told why', () => {
  const result = describeTaxCheck({ found: true, restricted: true, company: null });
  assert.equal(result.company, null);
  assert.equal(result.type, 'error');
  assert.match(result.text, /đã tồn tại/);
  assert.match(result.text, /không thuộc hồ sơ/);
  assert.doesNotMatch(result.text, /Doanh nghiệp mới/);
  assert.equal(result.blocked, true);
  assert.match(result.text, /không thể tạo hồ sơ/);
});
