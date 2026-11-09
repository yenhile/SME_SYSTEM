import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/periodReport.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const report = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('quick ranges are computed from today in Vietnam time and include today', () => {
  assert.deepEqual(report.presetRange('7', '2026-11-06'), { from: '2026-10-31', to: '2026-11-06' });
  assert.deepEqual(report.presetRange('30', '2026-11-06'), { from: '2026-10-08', to: '2026-11-06' });
  assert.deepEqual(report.presetRange('month', '2026-11-06'), { from: '2026-11-01', to: '2026-11-06' });
  assert.deepEqual(report.presetRange('quarter', '2026-11-06'), { from: '2026-10-01', to: '2026-11-06' });
  assert.deepEqual(report.presetRange('quarter', '2026-03-31'), { from: '2026-01-01', to: '2026-03-31' });
  assert.deepEqual(report.presetRange('year', '2026-11-06'), { from: '2026-01-01', to: '2026-11-06' });
  assert.equal(report.todayKey(new Date('2026-11-06T18:00:00Z')), '2026-11-07');
});

test('empty values read as a dash, never NaN or null', () => {
  assert.equal(report.rateText(null), '—');
  assert.equal(report.hoursText(null), '—');
  assert.equal(report.rateText(66.7), '66,7%');
  assert.equal(report.vndText(5e9), '5 tỷ');
  assert.equal(report.vndText(630e6), '630 triệu');
  assert.equal(report.dateText('2026-11-06'), '06/11/2026');
  assert.equal(report.monthText('2026-11'), '11/2026');
});

test('CSV has every section, escapes commas and quotes, and leaves empty rates blank', () => {
  const data = {
    range: { from: '2026-11-01', to: '2026-11-06', days: 6 },
    totals: { created: 3, completed: 2, approved: 1, rejected: 1, closedTimeout: 0, approvalRate: null, approvedAmount: 2e9 },
    stages: [{ stageCode: 'TIEP_NHAN', handled: 0, delayed: 0, delayRate: null, avgNetWorkHours: null }],
    byOfficer: [{ id: 'u', fullName: 'Nguyễn "A", B', created: 1, completed: 1, approved: 1, rejected: 0, receptionHandled: 1, receptionDelayed: 0 }],
    byLoanType: [{ loanType: 'THAU_CHI', created: 1, approved: 0, approvedAmount: 0 }],
    monthly: [{ month: '2026-11', created: 3, completed: 2 }],
    basis: 'Ghi chú, có dấu phẩy',
  };
  const csv = report.reportToCsv(data, { stage: code => `CD-${code}`, loanType: code => `LV-${code}` });
  for (const part of ['Tổng quan', 'Theo công đoạn', 'Theo cán bộ', 'Theo loại vay', 'Theo tháng']) assert.ok(csv.includes(part), part);
  assert.ok(csv.includes('"Nguyễn ""A"", B"'));
  assert.ok(csv.includes('CD-TIEP_NHAN,0,0,,'));
  assert.ok(csv.includes('Tỷ lệ phê duyệt (%),\r\n') || csv.includes('Tỷ lệ phê duyệt (%),'));
  assert.ok(csv.includes('"Ghi chú, có dấu phẩy"'));
  assert.equal(csv.includes('NaN') || csv.includes('null') || csv.includes('undefined'), false);
});

test('the report is rendered only for the Branch Manager and uses the manager-only endpoint', async () => {
  const dashboard = await readFile(new URL('../src/components/DashboardView.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /activeRole === 'QUAN_LY' && <PeriodReport \/>/);
  const component = await readFile(new URL('../src/components/PeriodReport.tsx', import.meta.url), 'utf8');
  assert.match(component, /\/dashboard\/report\?from=/);
});
