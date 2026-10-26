import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/taxCheck.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const module = { exports: {} };
new Function('module', 'exports', outputText)(module, module.exports);
const { describeTaxCheck } = module.exports;

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
