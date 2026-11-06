import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
async function load(file, dependencies = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const review = await load('../src/portal/review.ts');
const wizard = await load('../src/portal/wizard.ts');
const icons = new Proxy({}, { get: (_, name) => () => React.createElement('svg', { 'data-icon': String(name) }) });
const { PortalReview } = await load('../src/portal/PortalReview.tsx', { './review': review, './wizard': wizard, './review.css': {}, 'lucide-react': icons });
const assessment = { dataReady: true, issues: [], formErrors: [], requirements: [] };
const base = {
  data: { companyName: 'Doanh nghiệp kiểm thử', proposedAmount: 2000000000, loanTermMonths: 12, submissionDeclaration: { accepted: true } },
  request: { documents: [], status: 'DRAFT' },
  config: { canSubmit: true, intakeCycleEnabled: true, approvedIntakePolicy: { policy: { declaration: { text: 'Cam kết kiểm thử', version: 'test-v1' } } } },
  checklist: { approvedIntakeAssessment: assessment }, issues: [], busy: false, editable: true, conflict: false, dirty: false,
  pendingFiles: 0, fresh: true, checkError: false, submitDisabled: false, displayValue: value => value === undefined ? 'Chưa khai' : String(value),
  onJump: () => {}, onSave: () => {}, onSubmit: () => {}, onDeclaration: () => {},
};
const render = props => renderToStaticMarkup(React.createElement(PortalReview, { ...base, ...props }));
const text = html => html.replace(/<[^>]+>/g, ' ');

test('review presents four sections and one declaration/submit region, without raw or duplicate field errors', () => {
  const html = render({ checklist: { approvedIntakeAssessment: { ...assessment, dataReady: false,
    issues: [{ path: 'representative.mode', step: 1, message: 'Cần chọn tư cách người gửi.' }],
    formErrors: ['Thiếu thông tin: representative.mode', 'Thiếu thông tin điều kiện: representative.mode'],
  } }, submitDisabled: true });
  assert.equal((html.match(/class="review-section"/g) ?? []).length, 4);
  assert.equal((html.match(/class="review-declaration"/g) ?? []).length, 1);
  assert.equal((text(html).match(/Cần chọn tư cách người gửi/g) ?? []).length, 1);
  assert.doesNotMatch(text(html), /representative\.mode/);
  assert.match(html, /aria-describedby="review-submit-help"/);
});

test('existing submit-disabled guard remains authoritative even with a ready-looking assessment', () => {
  assert.match(render({ submitDisabled: true }), /<button[^>]*disabled=""[^>]*aria-describedby="review-submit-help"/);
  assert.doesNotMatch(render({ submitDisabled: false }), /<button[^>]*disabled=""[^>]*aria-describedby="review-submit-help"/);
  assert.match(text(render({ dirty: true, submitDisabled: true })), /Bấm Lưu nháp/);
  assert.doesNotMatch(text(render({ fresh: false, submitDisabled: true })), /Sẵn sàng gửi đề nghị/);
});

test('readonly reviews retain all data and declaration but disable mutation controls', () => {
  const html = render({ editable: false, submitDisabled: true });
  assert.match(text(html), /Doanh nghiệp kiểm thử/);
  assert.match(text(html), /chế độ xem/);
  assert.match(html, /<input[^>]*disabled=""[^>]*checked=""/);
});

test('deferred and inapplicable documents remain available without being labelled missing', () => {
  const html = render({ checklist: { approvedIntakeAssessment: { ...assessment, requirements: [
    { id: 'later', label: 'Dòng tiền chi tiết', state: 'LATER' },
    { id: 'na', label: 'Giấy ủy quyền', state: 'NOT_APPLICABLE' },
  ] } } });
  assert.match(text(html), /Cung cấp sau khi được yêu cầu/);
  assert.match(text(html), /Không áp dụng theo khai báo/);
  assert.doesNotMatch(text(html), /Cần cung cấp khi gửi/);
});

test('legacy document blockers remain visible even without an approved assessment', () => {
  const html = render({ checklist: { missing: ['legacy-doc'] }, submitDisabled: true });
  assert.match(text(html), /Cần bổ sung tài liệu theo danh mục/);
  assert.doesNotMatch(text(html), /legacy-doc/);
});

test('legacy readiness notices use the same translated, deduplicated review', () => {
  const html = render({ config: { ...base.config, intakeCycleEnabled: false },
    checklist: { formErrors: ['Thiếu thông tin: revenuePeriod'] },
    readiness: { dataReady: false, issues: [{ path: 'revenuePeriod', step: 1, message: 'Cần có dữ liệu thực: revenuePeriod.' }] }, submitDisabled: true });
  assert.doesNotMatch(text(html), /revenuePeriod/);
  assert.match(text(html), /Năm báo cáo doanh thu|năm báo cáo doanh thu/);
  assert.equal((text(html).match(/Vui lòng bổ sung năm báo cáo doanh thu/g) ?? []).length, 1);
});
