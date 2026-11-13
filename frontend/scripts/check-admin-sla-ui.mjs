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
const roleGuideSource = await readFile(new URL('../src/roleGuide.ts', import.meta.url), 'utf8');
const roleGuide = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(roleGuideSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`);
const roles = [
  { code: 'ADMIN', name: 'Quản trị viên hệ thống', description: null, activeUsers: 1, totalUsers: 1 },
  { code: 'CBTD', name: 'Cán bộ tín dụng', description: null, activeUsers: 3, totalUsers: 5 },
];
const responses = {
  '/users': [{ id: 'u1', username: 'nam.hoang', fullName: 'Hoàng Nam', email: 'nam@bank.test', branchName: 'HCM', roles: ['CBTD'], isActive: true, workloadActiveLoans: 4 }, { id: 'u2', username: 'oanh.trinh', fullName: 'Trịnh Oanh', email: 'oanh@bank.test', branchName: 'HCM', roles: ['CBTD'], isActive: false, workloadActiveLoans: 0 }],
  '/admin/roles': roles,
  '/admin/workflow-stages': stages,
  '/admin/sla-overview': { openLoans: { TIEP_NHAN: 7, THAM_DINH: 3 }, prediction: { slaRangeHours: { TIEP_NHAN: [24, 128], THAM_DINH: [16, 80] } } },
  '/dashboard/sla-bottlenecks': [
    { stageCode: 'TIEP_NHAN', stageName: 'Tiếp nhận', standardSlaHours: 112, totalHandled: 186, delayedCount: 4, delayRate: 2.2, avgNetWorkHours: 35.4, isBottleneck: false, pa1: { totalHandled: 0, delayedCount: 0, delayRate: 0, avgNetWorkHours: 0, isBottleneck: false } },
    { stageCode: 'THAM_DINH', stageName: 'Thẩm định', standardSlaHours: 40, totalHandled: 10, delayedCount: 1, delayRate: 10, avgNetWorkHours: 20, isBottleneck: false, pa1: { totalHandled: 10, delayedCount: 1, delayRate: 10, avgNetWorkHours: 20, isBottleneck: false } },
  ],
};
const module = { exports: {} };
const requests = [];
const dependencies = {
  '../slaDisplay': slaDisplay,
  '../roleGuide': roleGuide,
  '../api/client': { api: { get: async url => { requests.push(url); return responses[url]; } } },
  '../context/AuthContext': {
    useAuth: () => ({ user: { id: 'admin-test' }, restoreSession: async () => {} }),
    ROLE_NAMES: { ADMIN: 'Admin', CBTD: 'CBTD', THAM_QUYEN: 'Thẩm quyền', QUAN_LY: 'Quản lý' },
  },
};
new Function('require', 'module', 'exports', outputText)(name => dependencies[name] ?? require(name), module, module.exports);
const { AdminView, RoleChoice, AccountStatusField, lockBlockReason, accountUpdatePayload, slaChangePrompt } = module.exports;
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
    assert.ok(html.includes(`readonly="" value="${stage.stageName}"`), `${stage.stageCode} tên công đoạn chỉ xem`);
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
  assert.deepEqual(requests, ['/users', '/admin/roles']);
  assert.match(html, /<h2>Liên hệ cá nhân<\/h2>/);
  assert.doesNotMatch(html, /Tài khoản &amp; vai trò/);
  assert.match(html, /Tạo tài khoản/);
  assert.doesNotMatch(html, /class="sla-row"/);
  assert.match(html, /<td>4<\/td>/, 'số hồ sơ đang phụ trách');
  assert.doesNotMatch(html, /Danh mục vai trò|admin-readonly/, 'không còn khối danh mục cuối trang');
  assert.doesNotMatch(html, /Xóa/);
});

test('Each role checkbox in the account form shows its first scope line and active account count', () => {
  const html = renderToStaticMarkup(React.createElement(RoleChoice, { role: 'CBTD', row: roles[1], checked: true, onChange: () => {} }));
  assert.match(html, /<input type="checkbox" aria-describedby="role-choice-CBTD" checked=""/);
  assert.match(html, />CBTD</);
  assert.match(html, /3\/5 tài khoản hoạt động/);
  assert.ok(html.includes(`id="role-choice-CBTD">${roleGuide.ROLE_GUIDE.CBTD[0]}`), 'dòng phạm vi việc đầu tiên');
  assert.doesNotMatch(html, new RegExp(roleGuide.ROLE_GUIDE.CBTD[1]), 'chỉ một dòng');
  const missing = renderToStaticMarkup(React.createElement(RoleChoice, { role: 'QUAN_LY', checked: false, onChange: () => {} }));
  assert.doesNotMatch(missing, /tài khoản hoạt động/, 'chưa đọc được số liệu thì không hiện số');
});

test('Account status is a colored badge with text and each edit button names its account', async () => {
  const html = await mount('users');
  assert.match(html, /<span class="badge badge-soft-green">Hoạt động<\/span>/);
  assert.match(html, /<span class="badge badge-soft-gray">Đã khóa<\/span>/);
  assert.match(html, /aria-label="Sửa \/ Cấp quyền nam\.hoang"/);
  assert.match(html, /<div class="page-actions">[^]*Tạo tài khoản[^]*Làm mới[^]*<\/div>/, 'nút tạo nằm cạnh Làm mới');
});

test('Admin SLA shows actual handling and open loans per quota, without read-only blocks', async () => {
  requests.length = 0;
  const html = await mount('settings');
  assert.deepEqual(requests, ['/admin/workflow-stages', '/admin/sla-overview', '/dashboard/sla-bottlenecks']);
  assert.doesNotMatch(html, /Tình trạng hệ thống|Lịch làm việc tính SLA/);
  const tiepNhan = slaDisplay.stageActualFigures(responses['/dashboard/sla-bottlenecks'][0]);
  const thamDinh = slaDisplay.stageActualFigures(responses['/dashboard/sla-bottlenecks'][1]);
  assert.deepEqual(tiepNhan, { handled: 186, avgText: '35.4 giờ', delayRate: 2.2 });
  assert.deepEqual(thamDinh, { handled: 10, avgText: slaDisplay.workingDurationText(20), delayRate: 10 });
  assert.ok(html.includes(`Thực tế trung bình ${tiepNhan.avgText}`));
  assert.match(html, /Tỷ lệ trễ 2\.2% \(186 hồ sơ đã xử lý\)/);
  assert.match(html, /7 hồ sơ đang mở giữ định mức cũ khi sửa/);
  assert.match(html, /3 hồ sơ đang mở giữ định mức cũ khi sửa/);
  assert.match(html, /Mô hình dự báo hỗ trợ 3–16 ngày làm việc/);
  assert.match(html, /Mô hình dự báo hỗ trợ 2–10 ngày làm việc/);
  assert.doesNotMatch(html, /Mốc liên quan|admin-readonly/);
  assert.equal((html.match(/<input(?![^>]*readonly)[^>]*type="number"/g) ?? []).length, 2, 'chỉ hai ô định mức được sửa');
});

test('Self edit never sends roles or account status; editing others does', () => {
  const form = { username: 'a', password: '', fullName: 'A', email: 'a@x', phone: '', branchName: 'HCM', roles: ['ADMIN', 'THAM_QUYEN'], isActive: false };
  assert.deepEqual(accountUpdatePayload(form, true), { fullName: 'A', phone: '', branchName: 'HCM' });
  assert.deepEqual(accountUpdatePayload(form, false), { fullName: 'A', phone: '', branchName: 'HCM', roles: ['ADMIN', 'THAM_QUYEN'], isActive: false });
});

test('SLA change asks for confirmation with old and new quota, open loans and the prediction impact', () => {
  const stage = { stageCode: 'THAM_DINH', stageName: 'Thẩm định', standardSlaHours: 40 };
  const context = { openLoans: 3, slaRangeHours: [16, 80] };
  assert.equal(slaChangePrompt(stage, 5, context), null);
  const inside = slaChangePrompt(stage, 6, context);
  assert.match(inside, /từ 5 sang 6 ngày làm việc/);
  assert.match(inside, /3 hồ sơ đang mở giữ định mức cũ/);
  assert.match(inside, /Dự báo trễ SLA của hồ sơ vào công đoạn sau khi lưu sẽ tính theo định mức mới/);
  const outside = slaChangePrompt(stage, 12, context);
  assert.match(outside, /ngoài dải mô hình dự báo đã học \(2–10 ngày làm việc\)/);
  assert.match(outside, /sẽ không có dự báo trễ SLA/);
  assert.match(slaChangePrompt(stage, 6, { openLoans: 0, slaRangeHours: null }), /Chưa đọc được dải định mức của mô hình dự báo/);
});

test('LH-01: account status is a two-option field placed right after the full name', async () => {
  const source = await readFile(new URL('../src/components/AdminView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Tài khoản hoạt động<\/label>/, 'không còn ô tích ở cuối form');
  assert.ok(source.indexOf('<AccountStatusField') > source.indexOf('<label>Họ tên'), 'sau Họ tên');
  assert.ok(source.indexOf('<AccountStatusField') < source.indexOf('<label>Chi nhánh'), 'trước Chi nhánh');
  const html = renderToStaticMarkup(React.createElement(AccountStatusField, { active: true, isSelf: false, blockReason: null, onChange: () => {} }));
  assert.match(html, /<legend>Trạng thái<\/legend>/);
  assert.match(html, /type="radio"[^>]*checked=""[^>]*\/>Hoạt động/);
  assert.match(html, /type="radio"(?![^>]*disabled)[^>]*\/>Đã khóa/);
});

test('LH-02: locking an officer with open work is disabled with the reason shown at the option', () => {
  assert.equal(lockBlockReason({ isActive: true, workloadActiveLoans: 0, pendingPortalRequests: 0 }), null);
  assert.equal(lockBlockReason({ isActive: false, workloadActiveLoans: 3, pendingPortalRequests: 0 }), null, 'đã khóa thì không chặn');
  const reason = lockBlockReason({ isActive: true, workloadActiveLoans: 6, pendingPortalRequests: 1 });
  assert.equal(reason, 'Đang phụ trách 6 hồ sơ chưa hoàn tất và 1 đề nghị Portal. Hãy điều chuyển trước khi khóa.');
  assert.equal(lockBlockReason({ isActive: true, workloadActiveLoans: 2 }), 'Đang phụ trách 2 hồ sơ chưa hoàn tất. Hãy điều chuyển trước khi khóa.');
  const html = renderToStaticMarkup(React.createElement(AccountStatusField, { active: true, isSelf: false, blockReason: reason, onChange: () => {} }));
  assert.match(html, /type="radio"[^>]*disabled=""[^>]*\/>Đã khóa/);
  assert.ok(html.includes(`>${reason}</p>`));
  const self = renderToStaticMarkup(React.createElement(AccountStatusField, { active: true, isSelf: true, blockReason: null, onChange: () => {} }));
  assert.match(self, /^<fieldset class="account-status-field" disabled="">/, 'tự sửa mình: khóa cả nhóm lựa chọn');
});
