import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the real form without executing browser effects or making HTTP calls.
const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/components/IntakeAssignment.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const module = { exports: {} };
new Function('require', 'module', 'exports', outputText)(name => name === '../api/client' ? { api: {} } : require(name), module, module.exports);
const { IntakeAssignment } = module.exports;
const render = (activeRole, status, assignedTo = null) => renderToStaticMarkup(React.createElement(IntakeAssignment, {
  activeRole, request: { id: 'request', status, assignedTo }, disabled: false, onUpdated: async () => {},
}));

test('manager can assign submitted and reassign pending intake without choosing automatically', () => {
  const submitted = render('QUAN_LY', 'SUBMITTED');
  assert.match(submitted, /<form/);
  assert.match(submitted, /Chọn cán bộ/);
  assert.match(submitted, /selected=""/);
  assert.match(render('QUAN_LY', 'ASSIGNED', 'officer'), /Điều chuyển trước tiếp nhận/);
  assert.doesNotMatch(render('QUAN_LY', 'ACCEPTED', 'officer'), /<form/);
});

test('other internal actors have read-only assignment history', () => {
  for (const role of ['CBTD', 'THAM_QUYEN', 'ADMIN', null]) {
    for (const status of ['SUBMITTED', 'ASSIGNED', 'ACCEPTED']) {
      const html = render(role, status);
      assert.doesNotMatch(html, /<form|<textarea|<select/);
      assert.match(html, /Lịch sử phân công/);
    }
  }
});

test('accepted intake explicitly describes its officer assignment as historical', () => {
  assert.match(render('QUAN_LY', 'ACCEPTED', 'officer'), /CBTD được phân công trước tiếp nhận/);
  assert.match(render('QUAN_LY', 'ASSIGNED', 'officer'), /Cán bộ được giao/);
  assert.doesNotMatch(render('QUAN_LY', 'ASSIGNED', 'officer'), /CBTD được phân công trước tiếp nhận/);
});
