import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/slaDisplay.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const display = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('policy label distinguishes the legacy real-hours calculation from PA1 working hours', () => {
  assert.equal(display.slaPolicyLabel(null), 'Giờ thực (cách cũ)');
  assert.equal(display.slaPolicyLabel(undefined), 'Giờ thực (cách cũ)');
  assert.equal(display.slaPolicyLabel('PA1'), 'Giờ làm việc (PA1)');
});

test('state label says who the loan is waiting for and whether the SLA clock runs', () => {
  assert.equal(display.slaStateLabel(null), null);
  assert.equal(display.slaStateLabel({ policy: 'PA1', waiting: null, slaRunning: true }), null);
  assert.match(display.slaStateLabel({ policy: 'PA1', waiting: 'ENTERPRISE', slaRunning: false }), /chờ doanh nghiệp.*tạm dừng/i);
  assert.match(display.slaStateLabel({ policy: 'PA1', waiting: 'BANK', slaRunning: true }), /ngân hàng.*SLA đang chạy/i);
  assert.match(display.slaStateLabel({ policy: null, waiting: 'ENTERPRISE', slaRunning: false }), /cách tính cũ/);
});

test('prediction label never invents a value and names the PA1 reason', () => {
  assert.equal(display.predictionLabel('INCOMPATIBLE_PA1'), 'Chưa có dự báo tương thích PA1');
  assert.equal(display.predictionLabel('NONE'), 'Chưa dự báo');
  assert.equal(display.predictionLabel(undefined), 'Chưa dự báo');
});

test('durations read in working days for PA1 and stay in hours for legacy loans', () => {
  assert.equal(display.workingDurationText(112), '14 ngày');
  assert.equal(display.workingDurationText(37.5), '4 ngày 5,5 giờ');
  assert.equal(display.workingDurationText(3), '3 giờ');
  assert.equal(display.stageDurationText(40, 'PA1'), '5 ngày');
  assert.equal(display.stageDurationText(40, null), '40h');
  assert.equal(display.stageStandardText('TIEP_NHAN', 112), '14 ngày làm việc');
  assert.equal(display.stageStandardText('THAM_DINH', 20), '2,5 ngày làm việc');
  assert.equal(display.stageStandardText('THAM_DINH', 24, null), '24 giờ');
  assert.equal(display.stageStandardText('HOAN_TAT', 8), 'Không tính SLA');
  assert.equal(display.stageStandardText('TIEP_NHAN', undefined), '—');
});

test('the detail text gives the deadline, or the remaining time while paused', () => {
  const base = { policy: 'PA1', standardHours: 40, netWorkHours: 8, remainingHours: 32, dueAt: '2026-12-02T03:00:00.000Z', waitingEnterprise: false, isOverdue: false, error: null };
  assert.match(display.slaSummaryText(base, false), /^Hạn .*02\/12\/2026.* · còn 4 ngày$/);
  assert.equal(display.slaSummaryText({ ...base, dueAt: null, waitingEnterprise: true }, false), 'Tạm dừng · còn 4 ngày');
  assert.match(display.slaSummaryText({ ...base, isOverdue: true, remainingHours: 0 }, false), /^Quá hạn · Hạn /);
  assert.equal(display.slaSummaryText({ ...base, dueAt: null }, false), 'Hạn nằm ngoài kỳ lịch SLA · còn 4 ngày');
  assert.equal(display.slaSummaryText({ ...base, netWorkHours: null, remainingHours: null, dueAt: null, error: 'Lịch hết kỳ' }, false), 'Lịch hết kỳ');
  assert.equal(display.slaSummaryText({ ...base, policy: null, dueAt: null, standardHours: 24, remainingHours: 10 }, false), 'Còn 10h');
  assert.equal(display.slaSummaryText(null, false), 'Chưa có dữ liệu SLA');
  assert.equal(display.slaSummaryText(null, true), 'Không tính SLA');
});

test('hours text rounds to two decimals and shows a dash when the value is missing', () => {
  assert.equal(display.hoursText(11), '11h');
  assert.equal(display.hoursText(193.016666667), '193.02h');
  assert.equal(display.hoursText(0), '0h');
  assert.equal(display.hoursText(null), '—');
  assert.equal(display.hoursText(undefined), '—');
  assert.equal(display.waitingOnLabel('BANK'), 'Chờ ngân hàng kiểm tra');
  assert.equal(display.waitingOnLabel('ENTERPRISE'), 'Chờ doanh nghiệp');
});
