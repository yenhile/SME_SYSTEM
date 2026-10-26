import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(require, module, module.exports);
  return module.exports;
}
const { canCloseOverdue } = await load('../src/components/closeOverdue.ts');
const { CloseOverdueForm } = await load('../src/components/CloseOverdueForm.tsx');

const overdue = { status: 'PENDING', overdueAt: '2026-10-30T03:00:00Z' };
const loan = (over = {}) => ({ currentStatus: 'SUPPLEMENT_REQUIRED', completedAt: null, supplementRequests: [overdue], ...over });

test('only the manager sees the close action, and only for an overdue loan waiting for supplement', () => {
  assert.equal(canCloseOverdue(loan(), 'QUAN_LY'), true);
  for (const role of ['CBTD', 'THAM_QUYEN', 'ADMIN', null, undefined]) assert.equal(canCloseOverdue(loan(), role), false);
  assert.equal(canCloseOverdue(loan({ supplementRequests: [{ status: 'PENDING', overdueAt: null }] }), 'QUAN_LY'), false);
  assert.equal(canCloseOverdue(loan({ supplementRequests: [{ status: 'RESOLVED', overdueAt: '2026-10-30T03:00:00Z' }] }), 'QUAN_LY'), false);
  assert.equal(canCloseOverdue(loan({ supplementRequests: undefined }), 'QUAN_LY'), false);
  assert.equal(canCloseOverdue(loan({ currentStatus: 'CLOSED_TIMEOUT' }), 'QUAN_LY'), false);
  assert.equal(canCloseOverdue(loan({ completedAt: '2026-11-01T00:00:00Z' }), 'QUAN_LY'), false);
});

test('close form requires a reason before it can be confirmed', () => {
  const html = renderToStaticMarkup(React.createElement(CloseOverdueForm, { applicationCode: 'HS-001', busy: false, onSubmit: () => {}, onCancel: () => {} }));
  assert.match(html, /Đóng hồ sơ do quá hạn bổ sung/);
  assert.match(html, /HS-001/);
  assert.match(html, /<textarea[^>]*required/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Xác nhận đóng hồ sơ/);
  assert.match(html, /không thể hoàn tác|khóa/i);
});

test('close form is locked while the request is running', () => {
  const html = renderToStaticMarkup(React.createElement(CloseOverdueForm, { applicationCode: 'HS-001', busy: true, onSubmit: () => {}, onCancel: () => {} }));
  assert.match(html, /<button[^>]*disabled=""[^>]*>(Đang đóng|Xác nhận đóng hồ sơ)/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Hủy/);
});
