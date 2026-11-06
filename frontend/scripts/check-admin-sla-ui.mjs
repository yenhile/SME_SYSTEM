import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/components/AdminView.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
const stages = [
  { stageCode: 'TIEP_NHAN', stageName: 'Tiếp nhận', standardSlaHours: 112, days: '14' },
  { stageCode: 'THAM_DINH', stageName: 'Thẩm định', standardSlaHours: 40, days: '5' },
  { stageCode: 'HOAN_TAT', stageName: 'Hoàn tất', standardSlaHours: 8 },
];
const slaDisplaySource = await readFile(new URL('../src/slaDisplay.ts', import.meta.url), 'utf8');
const slaDisplay = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(slaDisplaySource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`);
const module = { exports: {} };
const requests = [];
const dependencies = {
  '../slaDisplay': slaDisplay,
  '../api/client': { api: { get: async url => { requests.push(url); return url === '/users' ? [] : stages; } } },
  '../context/AuthContext': {
    useAuth: () => ({ user: { id: 'admin-test' }, restoreSession: async () => {} }),
    ROLE_NAMES: { ADMIN: 'Admin', CBTD: 'CBTD', THAM_QUYEN: 'Thẩm quyền', QUAN_LY: 'Quản lý' },
  },
};
new Function('require', 'module', 'exports', outputText)(name => dependencies[name] ?? require(name), module, module.exports);
const { AdminView } = module.exports;
const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;

async function mount(section) {
  const hooks = [], effects = [];
  let index = 0, mounted = false;
  function render() {
    index = 0;
    const previous = dispatcher.current;
    dispatcher.current = {
      useState(initial) {
        const slot = index++;
        if (!mounted) hooks[slot] = typeof initial === 'function' ? initial() : initial;
        return [hooks[slot], next => { hooks[slot] = typeof next === 'function' ? next(hooks[slot]) : next; }];
      },
      useEffect(effect) { index++; if (!mounted) effects.push(effect); },
    };
    try { const tree = AdminView({ section }); mounted = true; return tree; }
    finally { dispatcher.current = previous; }
  }
  render();
  for (const effect of effects) effect();
  await new Promise(resolve => setImmediate(resolve));
  return renderToStaticMarkup(render());
}

test('Admin SLA shows the working-day quota of each measured stage and hides Hoàn tất', async () => {
  const html = await mount('settings');
  for (const stage of stages.filter(item => item.days)) {
    assert.ok(html.includes(`value="${stage.stageName}"`), stage.stageCode);
    assert.ok(html.includes(`value="${stage.days}"`), stage.stageCode);
  }
  assert.equal((html.match(/class="sla-row"/g) ?? []).length, 2);
  assert.ok(!html.includes('value="Hoàn tất"'));
  assert.match(html, /SLA \(ngày làm việc\)/);
  assert.match(html, /step="0.5"/);
  assert.ok(requests.includes('/admin/workflow-stages'));
});

test('14 working days are stored as 112 hours and 2.5 as 20', () => {
  assert.equal(slaDisplay.daysToHours(14), 112);
  assert.equal(slaDisplay.daysToHours(2.5), 20);
  assert.equal(slaDisplay.hoursToDays(40), 5);
});

test('Admin users view continues loading accounts without loading SLA settings', async () => {
  requests.length = 0;
  const html = await mount('users');
  assert.deepEqual(requests, ['/users']);
  assert.match(html, /Tạo mới liên hệ/);
  assert.doesNotMatch(html, /class="sla-row"/);
});
