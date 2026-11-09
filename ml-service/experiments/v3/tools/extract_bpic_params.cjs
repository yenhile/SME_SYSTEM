/* Trích tham số hiệu chỉnh từ BPI Challenge 2012 (đã giải nén thành cases.json) cho bộ mô phỏng v3.
 * Thời gian tính theo GIỜ LÀM VIỆC (T2-T6, 08-12 và 13-17 theo giờ địa phương ghi trong log), không có ngày nghỉ lễ.
 * Chỉ ghi tham số thống kê tổng hợp, không ghi lại dữ liệu hồ sơ. Dùng: node extract_params.cjs <cases.json> <out.json>
 */
const fs = require('fs');
const cases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outFile = process.argv[3];

// ---- giờ địa phương không múi giờ: lấy đúng chữ số trong chuỗi thời gian ----
const parseLocal = (s) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
};
const MIN = 60000, DAY = 86400000;
const SESS = [[8 * 60, 12 * 60], [13 * 60, 17 * 60]];
function workingHours(a, b) {
  if (!(b > a)) return 0;
  let total = 0;
  for (let day = Math.floor(a / DAY) * DAY; day <= b; day += DAY) {
    const wd = new Date(day).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (const [s, e] of SESS) {
      const lo = Math.max(a, day + s * MIN), hi = Math.min(b, day + e * MIN);
      if (hi > lo) total += hi - lo;
    }
  }
  return total / 3600000;
}
const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const r = (x, d = 3) => (x == null ? null : +x.toFixed(d));

// ---- chuẩn bị từng hồ sơ ----
const rows = cases.map((c) => {
  const ev = c.events.filter((e) => e['time:timestamp']).map((e) => ({ n: e['concept:name'], lc: e['lifecycle:transition'], t: parseLocal(e['time:timestamp']) })).sort((x, y) => x.t - y.t);
  const names = new Set(ev.map((e) => e.n));
  let outcome = 'OTHER';
  if (names.has('A_DECLINED')) outcome = 'DECLINED'; else if (names.has('A_CANCELLED')) outcome = 'CANCELLED'; else if (names.has('A_APPROVED') || names.has('A_ACTIVATED')) outcome = 'APPROVED';
  return { ev, names, outcome, wh: workingHours(ev[0].t, ev[ev.length - 1].t) };
});

// ---- hàng đợi: cặp SCHEDULE -> START của một hoạt động ----
function queueItems(activity) {
  const items = [];
  for (const row of rows) {
    let sch = null;
    for (const e of row.ev) {
      if (e.n !== activity) continue;
      if (e.lc === 'SCHEDULE') sch = e.t;
      else if (e.lc === 'START' && sch != null) { items.push({ s: sch, st: e.t }); sch = null; }
    }
  }
  return items;
}
const lower = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; };

function waitStats(activity) {
  const items = queueItems(activity);
  const waits = items.map((i) => workingHours(i.s, i.st));
  const pos = waits.filter((w) => w > 0.05);
  const logs = pos.map(Math.log);
  // độ co giãn theo độ dài hàng đợi: ln(chờ) ~ a + beta * ln(1 + hàng đợi lúc xếp lịch)
  const sch = items.map((i) => i.s).sort((x, y) => x - y);
  const sta = items.map((i) => i.st).sort((x, y) => x - y);
  const xs = [], ys = [];
  items.forEach((i, k) => {
    const w = waits[k]; if (w <= 0.05) return;
    const queue = lower(sch, i.s) - lower(sta, i.s);
    xs.push(Math.log(1 + Math.max(0, queue))); ys.push(Math.log(w));
  });
  const mx = mean(xs), my = mean(ys);
  const beta = xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const alpha = my - beta * mx;
  const ssRes = xs.reduce((a, x, k) => a + (ys[k] - (alpha + beta * x)) ** 2, 0);
  const ssTot = ys.reduce((a, y) => a + (y - my) ** 2, 0);
  return {
    n_items: items.length, share_wait_over_3min: r(pos.length / items.length),
    median_wh: r(q(pos, .5)), p90_wh: r(q(pos, .9)), lognormal_mu: r(mean(logs)), lognormal_sigma: r(sd(logs)),
    queue_elasticity_beta: r(beta), queue_regression_r2: r(1 - ssRes / ssTot), queue_regression_n: xs.length,
    mean_queue_at_schedule: r(mean(xs.map((x) => Math.exp(x) - 1))),
  };
}

const result = { source: 'BPI Challenge 2012 (van Dongen, 4TU.ResearchData, DOI 10.4121/uuid:3926db30-f712-4394-aebc-75976070e91f)', unit: 'giờ làm việc T2-T6 08-12 13-17 theo giờ địa phương trong log; không có ngày nghỉ lễ', n_cases: rows.length };
result.review_queue_W_Valideren = waitStats('W_Valideren aanvraag');
result.first_handling_queue_W_Completeren = waitStats('W_Completeren aanvraag');
result.followup_queue_W_Nabellen_offertes = waitStats('W_Nabellen offertes');

// ---- tỷ lệ và số vòng "theo dõi hồ sơ chưa đủ" ----
const pop = rows.filter((x) => x.names.has('A_PREACCEPTED'));
const countComplete = (row, name) => row.ev.filter((e) => e.n === name && e.lc === 'COMPLETE').length;
const chase = pop.map((x) => countComplete(x, 'W_Nabellen incomplete dossiers'));
const positives = chase.filter((c) => c > 0);
result.supplement_like_chase = {
  population: 'hồ sơ có A_PREACCEPTED', n_population: pop.length, n_with_chase: positives.length,
  chase_rate: r(positives.length / pop.length),
  rounds_among_positive: { mean: r(mean(positives)), median: q(positives, .5), p90: q(positives, .9), max: Math.max(...positives), geometric_p_from_mean: r(1 / mean(positives)) },
  share_positive_with_1_round: r(positives.filter((c) => c === 1).length / positives.length),
  share_positive_up_to_3_rounds: r(positives.filter((c) => c <= 3).length / positives.length),
};

// ---- ảnh hưởng của bước theo dõi lên thời gian cả hồ sơ, KIỂM SOÁT theo kết cục ----
const ctrl = {};
for (const oc of ['APPROVED', 'CANCELLED']) {
  const a = pop.filter((x) => x.outcome === oc && countComplete(x, 'W_Nabellen incomplete dossiers') > 0).map((x) => x.wh);
  const b = pop.filter((x) => x.outcome === oc && countComplete(x, 'W_Nabellen incomplete dossiers') === 0).map((x) => x.wh);
  ctrl[oc] = { n_with: a.length, n_without: b.length, median_wh_with: r(q(a, .5), 1), median_wh_without: r(q(b, .5), 1), ratio_median: r(q(a, .5) / q(b, .5), 2) };
}
result.chase_effect_controlled_by_outcome = ctrl;

// ---- hình dạng thời gian cả hồ sơ (giờ làm việc) cho hồ sơ được duyệt ----
const ap = rows.filter((x) => x.outcome === 'APPROVED').map((x) => x.wh);
result.approved_case_total_wh = { n: ap.length, p25: r(q(ap, .25), 1), p50: r(q(ap, .5), 1), p75: r(q(ap, .75), 1), p90: r(q(ap, .9), 1) };
result.outcome_share = Object.fromEntries(['APPROVED', 'DECLINED', 'CANCELLED', 'OTHER'].map((k) => [k, r(rows.filter((x) => x.outcome === k).length / rows.length)]));

fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
