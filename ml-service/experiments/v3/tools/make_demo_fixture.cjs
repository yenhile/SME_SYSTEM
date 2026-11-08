/* Tạo backend/prisma/demo-cases.json: 194 hồ sơ giả lập (thuộc tập test của cases_v4.csv) để backend/scripts/seed-demo.cjs dựng hồ sơ demo.
 * Dùng: node make_demo_fixture.cjs <cases_v4.csv> <out.json>. Chỉ giữ các trường cần thiết, làm tròn để tệp nhỏ (~50 KB).
 */
const fs = require('node:fs');
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261106);
const [head, ...lines] = fs.readFileSync(process.argv[2], 'utf8').trim().split(/\r?\n/);
const cols = head.split(',');
const rows = lines.map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], isNaN(+v) ? v : +v]))).filter(r => r.split === 'test');
const picked = [...rows].sort(() => rnd() - 0.5).slice(0, 194).map(r => ({
  amount: r.proposed_amount_billion, term: r.loan_term_months, scope: r.business_scope, years: r.established_years, revenue: r.annual_revenue_billion,
  rounds: r.supplement_rounds, tn: r.tn_bank_hours, wait: r.dn_wait_hours, td: r.td_bank_hours,
}));
fs.writeFileSync(process.argv[3], JSON.stringify(picked));
console.log(picked.length + ' hồ sơ');
