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
const { notificationTarget } = await load('../src/components/notificationTarget.ts');
const { SupplementDeadlineBadge } = await load('../src/components/SupplementDeadlineBadge.tsx');
const { OverdueSupplementsPanel } = await load('../src/components/OverdueSupplementsPanel.tsx');
const badge = requests => renderToStaticMarkup(React.createElement(SupplementDeadlineBadge, { requests }));

test('portal notifications still open the intake, loan notifications open the loan', () => {
  assert.deepEqual(notificationTarget({ requestId: 'r1', applicationId: null }), { kind: 'intake', id: 'r1' });
  assert.deepEqual(notificationTarget({ requestId: null, applicationId: 'l1' }), { kind: 'loan', id: 'l1' });
  assert.deepEqual(notificationTarget({ requestId: 'r1', applicationId: 'l1' }), { kind: 'intake', id: 'r1' });
  assert.equal(notificationTarget({ requestId: null, applicationId: null }), null);
  assert.equal(notificationTarget({ requestId: 'r1' }).kind, 'intake');
});

test('deadline badge shows nothing, a warning after day 5, and red when overdue', () => {
  assert.equal(badge(undefined), '');
  assert.equal(badge([]), '');
  assert.equal(badge([{ status: 'PENDING', reminderSentAt: null, overdueAt: null }]), '');
  assert.match(badge([{ status: 'PENDING', reminderSentAt: '2026-10-26T04:00:00Z', overdueAt: null }]), /Sắp quá hạn bổ sung/);
  const overdue = badge([{ status: 'PENDING', reminderSentAt: '2026-10-26T04:00:00Z', overdueAt: '2026-10-30T04:00:00Z' }]);
  assert.match(overdue, /Quá hạn bổ sung/);
  assert.match(overdue, /badge-soft-red/);
  assert.equal(badge([{ status: 'RESOLVED', reminderSentAt: 'x', overdueAt: 'y' }]), '');
});

test('overdue panel lists loans for the manager and is hidden when empty', () => {
  const item = { id: 's1', applicationId: 'l1', applicationCode: 'HS-001', companyName: 'ABC', assignedOfficer: 'Nguyen A', assignedOfficerId: 'c', requestedAt: '2026-10-20T03:00:00Z', deadlineAt: null, overdueAt: '2026-10-30T03:00:00Z', daysOverdue: 3 };
  const html = renderToStaticMarkup(React.createElement(OverdueSupplementsPanel, { items: [item], onSelectLoan: () => {} }));
  assert.match(html, /HS-001/);
  assert.match(html, /ABC/);
  assert.match(html, /Nguyen A/);
  assert.match(html, /3 ngày/);
  assert.equal(renderToStaticMarkup(React.createElement(OverdueSupplementsPanel, { items: [], onSelectLoan: () => {} })), '');
});
