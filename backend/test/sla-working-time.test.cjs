const test = require('node:test');
const assert = require('node:assert/strict');
const {
  workingHoursBetween, workingMillisBetween, CalendarCoverageError, SIMULATED_CALENDAR_V1: calendar,
} = require('../dist/modules/workflow/sla/working-time');

// Giờ Việt Nam (UTC+7) cho một ngày/giờ cụ thể; không phụ thuộc đồng hồ hay múi giờ của máy chạy test.
const vn = (date, time) => new Date(`${date}T${time}:00+07:00`);
const hours = (a, b, pauses) => workingHoursBetween(a, b, calendar, pauses);

test('C.9.5(1) nghỉ trưa: 11:00 đến 14:00 cùng ngày làm việc tính 2 giờ', () => {
  assert.equal(hours(vn('2026-10-27', '11:00'), vn('2026-10-27', '14:00')), 2);
});

test('C.9.5(2) ngày nghỉ nối cuối tuần: 16:00 ngày 29/10 đến 09:00 ngày 02/11 tính 2 giờ', () => {
  assert.equal(hours(vn('2026-10-29', '16:00'), vn('2026-11-02', '09:00')), 2);
});

test('một ngày làm việc đầy đủ là 8 giờ; ranh giới ca không tính thêm', () => {
  assert.equal(hours(vn('2026-10-28', '08:00'), vn('2026-10-28', '17:00')), 8);
  assert.equal(hours(vn('2026-10-28', '12:00'), vn('2026-10-28', '13:00')), 0);
  assert.equal(hours(vn('2026-10-28', '16:30'), vn('2026-10-28', '17:30')), 0.5);
  assert.equal(hours(vn('2026-10-28', '07:00'), vn('2026-10-28', '08:30')), 0.5);
});

test('cuối tuần, ngày nghỉ giả lập và khoảng không đổi đều cho 0 giờ', () => {
  assert.equal(hours(vn('2026-10-31', '08:00'), vn('2026-11-01', '17:00')), 0);
  assert.equal(hours(vn('2026-10-30', '08:00'), vn('2026-10-30', '17:00')), 0);
  const t = vn('2026-10-27', '10:00');
  assert.equal(hours(t, t), 0);
  assert.equal(hours(vn('2026-10-27', '15:00'), vn('2026-10-27', '10:00')), 0);
});

test('tạm dừng chỉ loại phần giao với giờ làm việc, không trừ nghỉ trưa hai lần', () => {
  // Ngày 8 giờ; tạm dừng 10:00-15:00 chiếm 2 giờ (10-12) + 2 giờ (13-15) làm việc, không tính 12-13.
  const pause = [{ start: vn('2026-10-28', '10:00'), end: vn('2026-10-28', '15:00') }];
  assert.equal(hours(vn('2026-10-28', '08:00'), vn('2026-10-28', '17:00'), pause), 4);
});

test('tạm dừng qua đêm và cuối tuần chỉ trừ phần nằm trong giờ làm việc', () => {
  // Dừng từ 16:00 thứ Năm 29/10 đến 09:00 thứ Hai 02/11: giờ làm việc bị dừng là 1 giờ (16-17) + 1 giờ (08-09).
  const pause = [{ start: vn('2026-10-29', '16:00'), end: vn('2026-11-02', '09:00') }];
  // Tổng giờ làm việc: 8 (29/10) + 0 (30/10 nghỉ) + 8 (02/11) = 16; trừ 2 giờ dừng = 14.
  assert.equal(hours(vn('2026-10-29', '08:00'), vn('2026-11-02', '17:00'), pause), 14);
});

test('khoảng tạm dừng chồng nhau được gộp, không trừ trùng', () => {
  const pauses = [
    { start: vn('2026-10-28', '09:00'), end: vn('2026-10-28', '11:00') },
    { start: vn('2026-10-28', '10:00'), end: vn('2026-10-28', '12:00') },
  ];
  assert.equal(hours(vn('2026-10-28', '08:00'), vn('2026-10-28', '17:00'), pauses), 5);
});

test('khoảng tạm dừng còn mở được tính đến thời điểm kết thúc của lần gọi', () => {
  const open = [{ start: vn('2026-10-28', '14:00'), end: null }];
  // Ngày 8 giờ; dừng mở từ 14:00 đến 17:00 chiếm 3 giờ làm việc.
  assert.equal(hours(vn('2026-10-28', '08:00'), vn('2026-10-28', '17:00'), open), 5);
});

test('tạm dừng ngoài giờ làm việc hoặc ngoài khoảng tính không ảnh hưởng', () => {
  const weekendPause = [{ start: vn('2026-10-31', '08:00'), end: vn('2026-11-01', '17:00') }];
  assert.equal(hours(vn('2026-10-30', '08:00'), vn('2026-11-02', '17:00'), weekendPause), 8);
  const lunchPause = [{ start: vn('2026-10-28', '12:00'), end: vn('2026-10-28', '13:00') }];
  assert.equal(hours(vn('2026-10-28', '08:00'), vn('2026-10-28', '17:00'), lunchPause), 8);
  const outside = [{ start: vn('2026-11-04', '08:00'), end: vn('2026-11-04', '10:00') }];
  assert.equal(hours(vn('2026-10-28', '08:00'), vn('2026-10-28', '17:00'), outside), 8);
});

test('khoảng tính nằm ngoài kỳ lịch bị từ chối, không tự tính 24/7', () => {
  assert.throws(() => hours(vn('2026-10-23', '09:00'), vn('2026-10-27', '09:00')), CalendarCoverageError);
  assert.throws(() => hours(vn('2026-11-06', '09:00'), vn('2026-11-09', '09:00')), CalendarCoverageError);
  // Ngày cuối của kỳ vẫn tính được.
  assert.equal(hours(vn('2026-11-06', '15:00'), vn('2026-11-08', '12:00')), 2);
});

test('kết quả không phụ thuộc cách biểu diễn múi giờ của đầu vào', () => {
  const asUtc = (a, b) => workingMillisBetween(new Date(a), new Date(b), calendar);
  assert.equal(asUtc('2026-10-27T04:00:00Z', '2026-10-27T07:00:00Z'), 2 * 3600000);
});
