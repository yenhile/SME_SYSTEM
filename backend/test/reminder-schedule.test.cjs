const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {nextDailyScanAt}=require('../dist/modules/supplements/supplement-reminders.service');

// 08:00 giờ Việt Nam = 01:00 UTC
test('before 08:00 Vietnam time the next scan is today at 08:00',()=>{
  assert.equal(nextDailyScanAt(new Date('2026-11-02T00:30:00Z')).toISOString(),'2026-11-02T01:00:00.000Z');
});
test('at or after 08:00 the next scan is tomorrow at 08:00',()=>{
  assert.equal(nextDailyScanAt(new Date('2026-11-02T01:00:00Z')).toISOString(),'2026-11-03T01:00:00.000Z');
  assert.equal(nextDailyScanAt(new Date('2026-11-02T10:00:00Z')).toISOString(),'2026-11-03T01:00:00.000Z');
});
test('the Vietnamese date, not the UTC date, decides "today"',()=>{
  // 20:00 UTC ngày 2/11 đã là 03:00 ngày 3/11 ở Việt Nam, nên mốc kế tiếp là 08:00 ngày 3/11.
  assert.equal(nextDailyScanAt(new Date('2026-11-02T20:00:00Z')).toISOString(),'2026-11-03T01:00:00.000Z');
});
test('the hour can be configured and the result is always in the future',()=>{
  const now=new Date('2026-11-02T05:00:00Z');
  assert.equal(nextDailyScanAt(now,17).toISOString(),'2026-11-02T10:00:00.000Z');
  assert.ok(nextDailyScanAt(now,0).getTime()>now.getTime());
});
