import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  return readFile(new URL(path, import.meta.url), 'utf8').then(source => {
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', outputText)(name => dependencies[name] ?? require(name), module, module.exports);
    return module.exports;
  });
}
const helpers = await load('../src/portal/supplements.ts');
const { SupplementCard } = await load('../src/components/SupplementPanel.tsx', {
  '../portal.css': {}, '../portal/supplements': helpers, '../api/client': { api: {} }, '../portal/client': { portalApi: {} }, '../portal/DocumentLink': { DocumentLink: ({ fileName }) => React.createElement('button', null, fileName) },
});
const view = { id: 'supp', requestContent: 'Bổ sung BCTC', status: 'PENDING', revision: 2, requestedAt: '2026-10-23', items: [{ id: 'a', documentGroup: 'B', documentTypeCode: 'BCTC', reason: 'Thiếu kỳ', status: 'PENDING' }], files: [], events: [], notes: 'PRIVATE' };
const render = (value, mode, canEdit = true) => renderToStaticMarkup(React.createElement(SupplementCard, { view: value, mode, canEdit, busy: false, onUpload() {}, onRespond() {}, onReview() {}, onResolve() {}, download() {}, config: null }));
test('portal shows only opened items and public messages, locks sent/accepted items and legacy', () => {
  assert.match(render(view, 'portal'), /type="file"/);
  assert.doesNotMatch(render(view, 'portal'), /PRIVATE|Chấp nhận mục|Hoàn tất yêu cầu/);
  for (const status of ['SUBMITTED', 'ACCEPTED']) assert.doesNotMatch(render({ ...view, items: [{ ...view.items[0], status, message: 'Đã tiếp nhận' }] }, 'portal'), /type="file"/);
  assert.doesNotMatch(render({ ...view, items: [] }, 'portal'), /type="file"|Gửi tài liệu bổ sung/);
});
test('staff review is available only for submitted items and permitted role', () => {
  const sent = { ...view, items: [{ ...view.items[0], status: 'SUBMITTED' }] };
  assert.match(render(sent, 'staff'), /Chấp nhận mục/);
  assert.match(render(sent, 'staff'), /Thông điệp gửi doanh nghiệp/);
  assert.doesNotMatch(render(sent, 'staff', false), /Chấp nhận mục|textarea/);
  assert.doesNotMatch(render(view, 'staff'), /Chấp nhận mục/);
});
