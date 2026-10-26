import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/portal/PortalApplicationTracking.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const module = { exports: {} };
new Function('require', 'module', 'exports', outputText)(name => name === './client' ? { portalApi: {} } : require(name), module, module.exports);
const { TrackingView } = module.exports;

const steps = states => ['Tiếp nhận', 'Thẩm định', 'Phê duyệt', 'Hoàn tất'].map((label, index) => ({ code: `S${index}`, label, state: states[index] }));
const view = tracking => renderToStaticMarkup(React.createElement(TrackingView, { tracking: { requestId: 'r', reference: 'DN-1', submittedAt: '2026-10-20T03:00:00Z', acceptedAt: null, ...tracking } }));

test('shows the four public milestones with their state and the current status message', () => {
  const html = view({ status: { code: 'APPRAISAL', label: 'Đang thẩm định', message: 'Hồ sơ đang được thẩm định.' }, steps: steps(['done', 'current', 'pending', 'pending']) });
  for (const label of ['Tiếp nhận', 'Thẩm định', 'Phê duyệt', 'Hoàn tất']) assert.match(html, new RegExp(label));
  assert.match(html, /Đang thẩm định/);
  assert.match(html, /Hồ sơ đang được thẩm định\./);
  assert.match(html, /tracking-step done/);
  assert.match(html, /tracking-step current[^"]*"[^>]*aria-current="step"/);
  assert.match(html, /DN-1/);
});

test('a rejected request shows only the general reason', () => {
  const html = view({ status: { code: 'REJECTED', label: 'Không được chấp thuận', message: 'Hồ sơ không được chấp thuận.' }, steps: steps(['done', 'done', 'pending', 'stopped']), rejection: { code: 'TC02', label: 'Năng lực tài chính không đảm bảo' } });
  assert.match(html, /Lý do/);
  assert.match(html, /Năng lực tài chính không đảm bảo/);
  assert.match(html, /tracking-step stopped/);
});

test('a request without a rejection does not show a reason block', () => {
  const html = view({ status: { code: 'APPROVED', label: 'Đã được phê duyệt', message: 'Hồ sơ đã được phê duyệt.' }, steps: steps(['done', 'done', 'done', 'done']) });
  assert.doesNotMatch(html, /Lý do/);
});

test('the supplement status hints how to respond', () => {
  const html = view({ status: { code: 'SUPPLEMENT_REQUIRED', label: 'Cần bổ sung chứng từ', message: 'Vui lòng mở mục "Bổ sung hồ sơ sau tiếp nhận" để gửi tài liệu.' }, steps: steps(['current', 'pending', 'pending', 'pending']) });
  assert.match(html, /Cần bổ sung chứng từ/);
  assert.match(html, /Bổ sung hồ sơ sau tiếp nhận/);
});
