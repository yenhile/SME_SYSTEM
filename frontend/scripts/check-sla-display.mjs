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

test('hours text rounds to two decimals and shows a dash when the value is missing', () => {
  assert.equal(display.hoursText(11), '11h');
  assert.equal(display.hoursText(193.016666667), '193.02h');
  assert.equal(display.hoursText(0), '0h');
  assert.equal(display.hoursText(null), '—');
  assert.equal(display.hoursText(undefined), '—');
  assert.equal(display.waitingOnLabel('BANK'), 'Chờ ngân hàng kiểm tra');
  assert.equal(display.waitingOnLabel('ENTERPRISE'), 'Chờ doanh nghiệp');
});
