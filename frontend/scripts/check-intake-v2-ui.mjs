import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Synthetic fixtures render the real components only; no HTTP/live proof is implied.
const require = createRequire(import.meta.url);
const cache = new Map();
function load(path) {
  const url = new URL(path, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  const module = { exports: {} }; cache.set(url.href, module.exports);
  const source = readFileSync(url, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  new Function('require', 'module', 'exports', outputText)(name => {
    if (name === '../api/client') return { api: {}, ApiError: class extends Error {} };
    if (name === '../portal/PortalApp') return { RequestFields: ({ data, readOnly }) => React.createElement('p', null, `legacy:${data.companyName}:${readOnly}`) };
    if (name.startsWith('.')) {
      const target = new URL(name, url);
      return load(new URL(['/model','/wizard'].some(suffix=>target.pathname.endsWith(suffix)) ? `${target.href}.ts` : `${target.href}.tsx`).href);
    }
    return require(name);
  }, module, module.exports);
  cache.set(url.href, module.exports); return module.exports;
}

test('V2 staff details expose complete read-only fields from submitted snapshot', () => {
  const { PortalIntakeDetails } = load('../src/components/PortalIntakeDetails.tsx');
  const data = { companyName: 'Frozen Company', contactName: 'Contact A', contactPosition: 'Accountant', contactPhone: '0901234567', contactEmail: 'contact@example.test', revenuePeriod: '2025-Q4', preferredBranch: 'Branch A', hasExistingDebt: false, collateral: { mode: 'NONE_REQUESTED', description: 'Collateral note' }, capitalPlan: { businessActivity: 'Manufacturing', costs: [{ name: 'Steel', amount: 123456, plannedAt: '2026-11-01' }], ownFunds: 1, otherFunds: 2, otherFundsSource: 'Partner', useFrom: '2026-11-01', useTo: '2026-12-01', repaymentSource: 'Sales proceeds', recoveryDate: '2026-12-02' } };
  const documents = [{ id: 'frozen-doc', fileName: 'frozen.pdf', fileSize: 2048, documentGroup: 'B', uploadedAt: '2026-10-22', version: 3, coverage: [{ documentTypeCode: 'B_FIN', period: '2025' }] }];
  const request = { id: 'r', formVersion: 2, data: { companyName: 'Mutable Company' }, documents: [{ ...documents[0], fileName: 'mutable.pdf' }], checklistSnapshot: { snapshotVersion: 2, requestId: 'r', formVersion: 2, checklistVersion: 'TEST-1', revision: 9, submittedAt: '2026-10-22', data, documents, policy: { status: 'TEST_ONLY' }, checklist: [{ id: 'financial', group: 'B', documentTypeCode: 'B_FIN', required: true, applies: false, deferred: true, stage: 'LATER', periods: ['2025'], basis: 'Synthetic policy basis' }] } };
  const config = { groups: [{ code: 'B', name: 'Finance catalog', documentTypes: [{ code: 'B_FIN', name: 'Financial report' }] }] };
  const html = renderToStaticMarkup(React.createElement(PortalIntakeDetails, { request, config }));
  for (const value of ['Frozen Company', 'Contact A', 'Accountant', '0901234567', 'contact@example.test', '2025-Q4', 'Branch A', 'Collateral note', 'Manufacturing', 'Steel', '123.456', '2026-11-01', '2026-12-01', 'Sales proceeds', '2026-12-02', 'Partner', 'frozen.pdf', 'Financial report', 'Finance catalog', 'TEST-1', '2025', 'Synthetic policy basis', 'Không có dư nợ', 'Không áp dụng', 'Hoãn cung cấp']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /Mutable Company|mutable.pdf|<input|<select|<textarea|NaN|undefined|\[object Object\]/);
  assert.match(html, /chưa thay thế việc kiểm tra/);
  assert.match(html, /Tổng nhu cầu vốn/);
  assert.match(html, /Tổng nguồn vốn/);
});

test('V1 keeps legacy read-only form and missing V2 numbers never become zero or NaN', () => {
  const { PortalIntakeDetails, intakeMoney } = load('../src/components/PortalIntakeDetails.tsx');
  const html = renderToStaticMarkup(React.createElement(PortalIntakeDetails, { request: { id: 'r', formVersion: 1, data: { companyName: 'Legacy' }, documents: [] }, config: null }));
  assert.match(html, /legacy:Legacy:true/);
  for (const value of [undefined, null, NaN, Infinity, 'invalid']) assert.equal(intakeMoney(value), '—');
  assert.equal(intakeMoney(0), '0 VNĐ');
});

test('unavailable snapshot is disclosed; V2 capability requires explicit server approval', () => {
  const { PortalIntakeDetails, canAcceptIntake } = load('../src/components/PortalIntakeDetails.tsx');
  const html = renderToStaticMarkup(React.createElement(PortalIntakeDetails, { request: { id: 'r', formVersion: 2, data: {}, documents: [] }, config: null }));
  assert.match(html, /Chưa có snapshot V2 hợp lệ/);
  assert.doesNotMatch(html, /NaN|undefined|\[object Object\]/);
  assert.equal(canAcceptIntake({ formVersion: 2 }, null), false);
  assert.equal(canAcceptIntake({ formVersion: 2 }, { canSubmit: true }), false);
  assert.equal(canAcceptIntake({ formVersion: 2 }, { canAccept: true }), true);
  assert.equal(canAcceptIntake({ formVersion: 1 }, null), true);
});
test('financial acknowledgement follows frozen MVP policy even when current policy config changes',()=>{
  const {mvpFinancialConfirmationRequired}=load('../src/components/PortalIntakeDetails.tsx');
  const request={id:'r',formVersion:2,data:{},documents:[],checklistSnapshot:{snapshotVersion:2,requestId:'r',formVersion:2,checklistVersion:'TEST-MVP',revision:0,submittedAt:'2026-10-23',data:{},documents:[],policy:{readinessVersion:'MVP1'},checklist:[]}};
  assert.equal(mvpFinancialConfirmationRequired(request),true);
  assert.equal(mvpFinancialConfirmationRequired({...request,checklistSnapshot:{...request.checklistSnapshot,policy:{}}}),false);
});

test('foreign or malformed snapshot falls back visibly and never maps arbitrary JSON to fields', () => {
  const { PortalIntakeDetails, intakeData } = load('../src/components/PortalIntakeDetails.tsx');
  const request = { id: 'own-request', formVersion: 2, data: { companyName: 'Current fallback' }, documents: [], checklistSnapshot: { snapshotVersion: 2, formVersion: 2, requestId: 'foreign-request', checklistVersion: 'TEST-1', revision: 1, submittedAt: '2026-10-22', data: { companyName: 'Foreign snapshot' }, documents: [], policy: {}, checklist: [], secretExtra: 'SHOULD_NOT_RENDER' } };
  const render = () => renderToStaticMarkup(React.createElement(PortalIntakeDetails, { request, config: null }));
  assert.equal(intakeData(request).companyName, 'Current fallback');
  assert.match(render(), /Current fallback/);
  assert.doesNotMatch(render(), /Foreign snapshot|SHOULD_NOT_RENDER/);
  request.checklistSnapshot.requestId = request.id;
  request.checklistSnapshot.checklist = [{ id: 'bad', group: 'A', documentTypeCode: 'A_TYPE', required: true, applies: true, stage: 'SUBMIT', periods: {} }];
  assert.match(render(), /Chưa có snapshot V2 hợp lệ/);
});
