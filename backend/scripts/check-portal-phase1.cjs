/* Local integration: creates tagged fixtures, sends only to the local SMTP inbox,
 * and removes only records/files created by this run. Never seeds/resets DB. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
const base = process.env.TEST_PORTAL_API_URL || 'http://127.0.0.1:3000/api';
const mailbox = process.env.TEST_MAILBOX_URL || 'http://127.0.0.1:8025';
for (const url of [base, mailbox]) assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Local tests only');
const tag = `portal_it_${Date.now()}_${randomUUID().slice(0, 6)}`;
const password = 'PortalTest@123456';
const owned = { emails: [], users: [], companies: [] };
let prisma;
let assertions = 0;

async function call(endpoint, { token, role, body, method = 'GET', raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (role) headers['X-Active-Role'] = role;
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + endpoint, { method, headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = raw ? Buffer.from(await response.arrayBuffer()) : await response.json().catch(() => null);
  return { status: response.status, data };
}
function expect(result, statuses, label) {
  assert.ok([].concat(statuses).includes(result.status), `${label}: HTTP ${result.status}, ${JSON.stringify(result.data?.message || '')}`);
  assertions++;
  return result.data;
}
async function codeFor(email) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${mailbox}/api/messages`, { signal: AbortSignal.timeout(2000) });
    const body = await response.json();
    const messages = Array.isArray(body) ? body : body.messages;
    const message = [...messages].reverse().find(m => JSON.stringify(m.to).includes(email));
    const code = message?.text?.match(/\b\d{6}\b/)?.[0];
    if (code) return code;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('No verification email arrived in local SMTP inbox');
}
async function register(email) {
  owned.emails.push(email);
  expect(await call('/portal/auth/register', { method: 'POST', body: { email, password, contactName: 'Portal integration contact', phone: '0900000000' } }), [200, 201], 'register');
  expect(await call('/portal/auth/login', { method: 'POST', body: { email, password } }), [401, 403], 'unverified login blocked');
  const code = await codeFor(email);
  expect(await call('/portal/auth/verify-email', { method: 'POST', body: { email, code } }), [200, 201], 'verify from SMTP email');
  const login = expect(await call('/portal/auth/login', { method: 'POST', body: { email, password } }), [200, 201], 'verified login');
  assert.ok(login.accessToken && login.account?.email === email);
  return login.accessToken;
}

// Small valid XLSX ZIP, avoiding fixture files in the repository.
function spreadsheet() {
  const files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Finance" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>8000000000</v></c></row></sheetData></worksheet>',
  };
  function crc32(buffer) { let c = -1; for (const b of buffer) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ -1) >>> 0; }
  const local = [], central = []; let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const n = Buffer.from(name), b = Buffer.from(value), h = Buffer.alloc(30), c = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc32(b), 14); h.writeUInt32LE(b.length, 18); h.writeUInt32LE(b.length, 22); h.writeUInt16LE(n.length, 26);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc32(b), 16); c.writeUInt32LE(b.length, 20); c.writeUInt32LE(b.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    local.push(h, n, b); central.push(c, n); offset += h.length + n.length + b.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
async function upload(id, token, group, name, buffer) {
  const form = new FormData(); form.append('documentGroup', group); form.append('file', new Blob([buffer]), name);
  return call(`/portal/requests/${id}/documents`, { token, method: 'POST', body: form });
}

async function cleanup() {
  if (!prisma) return;
  const accounts = await prisma.portalAccount.findMany({ where: { email: { in: owned.emails } }, select: { id: true } });
  const requests = await prisma.portalRequest.findMany({ where: { accountId: { in: accounts.map(a => a.id) } }, include: { documents: true } });
  const loanIds = requests.map(r => r.loanId).filter(Boolean);
  const documentPaths = requests.flatMap(r => r.documents.map(d => d.filePath));
  const requestIds = requests.map(r => r.id);
  await prisma.internalNotification.deleteMany({ where: { requestId: { in: requestIds } } });
  await prisma.portalAssignment.deleteMany({ where: { requestId: { in: requestIds } } });
  await prisma.portalRequest.updateMany({ where: { id: { in: requests.map(r => r.id) } }, data: { loanId: null } });
  // loan cascade removes only this run's internal documents/history.
  await prisma.loanApplication.deleteMany({ where: { id: { in: loanIds } } });
  await prisma.portalDocument.deleteMany({ where: { requestId: { in: requests.map(r => r.id) } } });
  await prisma.portalRequest.deleteMany({ where: { id: { in: requests.map(r => r.id) } } });
  await prisma.portalAccount.deleteMany({ where: { id: { in: accounts.map(a => a.id) } } });
  await prisma.company.deleteMany({ where: { id: { in: owned.companies } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.users } } });
  for (const file of documentPaths) {
    const directory = path.resolve(root, 'uploads');
    const candidate = path.resolve(directory, file);
    if (path.dirname(candidate) !== directory || path.basename(candidate) !== file) throw Error('Unexpected upload cleanup path');
    await fs.unlink(candidate).catch(e => { if (e.code !== 'ENOENT') throw e; });
  }
}

async function main() {
  const config = dotenv.parse(await fs.readFile(path.join(root, '.env')));
  const url = process.env.DATABASE_URL || config.DATABASE_URL;
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Local database only');
  prisma = new PrismaClient({ datasources: { db: { url } } });
  const { PDFDocument } = require('pdf-lib');
  const { PNG } = require('pngjs');
  const pdfDoc = await PDFDocument.create(); pdfDoc.addPage([100, 100]); const pdf = Buffer.from(await pdfDoc.save());
  const png = PNG.sync.write(new PNG({ width: 1, height: 1 }));
  const token = await register(`${tag}@example.test`);
  const otherToken = await register(`${tag}_other@example.test`);
  expect(await call('/auth/me', { token }), 401, 'portal token rejected by internal API');
  const actor = expect(await call('/auth/login', { method: 'POST', body: { username: process.env.TEST_CBTD_USERNAME || 'test_cbtd', password: process.env.TEST_CBTD_PASSWORD || '123456' } }), [200, 201], 'internal CBTD login');
  expect(await call('/portal/auth/me', { token: actor.accessToken }), 401, 'internal token rejected by portal');
  const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: 'CBTD' } });
  const staff = await prisma.user.create({ data: { username: tag, email: `${tag}_staff@example.test`, fullName: 'Portal integration officer', passwordHash: await bcrypt.hash(password, 10), roles: { create: { roleId: staffRole.id } } } }); owned.users.push(staff.id);
  const second = expect(await call('/auth/login', { method: 'POST', body: { username: tag, password } }), [200, 201], 'second internal officer');
  const manager = expect(await call('/auth/login', { method: 'POST', body: { username: 'test_quan_ly', password: '123456' } }), [200, 201], 'manager login');
  const managerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'QUAN_LY' } });
  const managerStaff = await prisma.user.create({ data: { username: `${tag}_manager`, email: `${tag}_manager@example.test`, fullName: 'Portal integration manager', passwordHash: await bcrypt.hash(password, 10), roles: { create: { roleId: managerRole.id } } } }); owned.users.push(managerStaff.id);
  const otherManager = expect(await call('/auth/login', { method: 'POST', body: { username: managerStaff.username, password } }), [200, 201], 'second manager login');
  const inactive = await prisma.user.create({ data: { username: `${tag}_inactive`, email: `${tag}_inactive@example.test`, fullName: 'Inactive test officer', isActive: false, passwordHash: await bcrypt.hash(password, 10), roles: { create: { roleId: staffRole.id } } } }); owned.users.push(inactive.id);
  const baselineLoanCount = await prisma.loanApplication.count();
  const company = await prisma.company.create({ data: { taxCode: String(Date.now()).slice(-10), companyName: `Original ${tag}`, industry: 'San xuat', establishedYear: 2010, annualRevenue: 10000000000, charterCapital: 5000000000, representativeName: 'Original representative', phone: '0900000000', address: 'Original address' } }); owned.companies.push(company.id);
  const companyHash = createHash('sha256').update(JSON.stringify(company)).digest('hex');
  const data = { taxCode: company.taxCode, companyName: `Submitted ${tag}`, industry: 'San xuat', establishedYear: 2015, annualRevenue: 15000000000, charterCapital: 8000000000, representativeName: 'Portal representative', phone: '0900000000', address: 'Portal address', loanPurpose: 'Working capital for production', loanType: 'VAY_VON_LUU_DONG', proposedAmount: 8000000000, loanTermMonths: 12 };
  const draft = expect(await call('/portal/requests', { token, method: 'POST', body: { data: { taxCode: data.taxCode } } }), [200, 201], 'partial draft');
  assert.equal(await prisma.internalNotification.count({ where: { requestId: draft.id } }), 0, 'draft does not notify');
  expect(await call(`/portal/requests/${draft.id}`, { token: otherToken }), 404, 'other account cannot read draft');
  expect(await call(`/portal/requests/${draft.id}/submit`, { token, method: 'POST' }), 400, 'incomplete submission rejected');
  expect(await call(`/portal/requests/${draft.id}`, { token, method: 'PUT', body: { data } }), 200, 'save full fields');
  expect(await upload(draft.id, token, 'A', 'fake.pdf', Buffer.from('Not a PDF')), 400, 'forged PDF rejected');
  expect(await upload(draft.id, token, 'A', 'finance.xlsx', spreadsheet()), 400, 'wrong file group rejected');
  for (const [group, name, bytes] of [['A', 'legal.pdf', pdf], ['B', 'finance.xlsx', spreadsheet()], ['C', 'production.pdf', pdf], ['D', 'plan.pdf', pdf], ['E', 'collateral.png', png], ['F', 'debts.xlsx', spreadsheet()]]) {
    expect(await upload(draft.id, token, group, name, bytes), [200, 201], `upload group ${group}`);
  }
  const complete = expect(await call(`/portal/requests/${draft.id}`, { token }), 200, 'load draft with six groups');
  assert.equal(complete.documents.length, 6);
  const first = complete.documents[0];
  expect(await call(`/portal/requests/${draft.id}/documents/${first.id}/download`, { token: otherToken, raw: true }), 404, 'other account cannot download');
  const submitted = expect(await call(`/portal/requests/${draft.id}/submit`, { token, method: 'POST' }), [200, 201], 'submit');
  assert.equal(submitted.status, 'SUBMITTED');
  const repeated = expect(await call(`/portal/requests/${draft.id}/submit`, { token, method: 'POST' }), [200, 201], 'retry submit'); assert.equal(repeated.id, draft.id);
  assert.equal(await prisma.internalNotification.count({ where: { requestId: draft.id, userId: manager.user.id } }), 1, 'submit retry notifies each manager once');
  expect(await call('/notifications', { token }), 401, 'portal token cannot read internal notices');
  const managerNotices = expect(await call('/notifications', { token: manager.accessToken, role: 'QUAN_LY' }), 200, 'manager receives submission notice');
  const notice = managerNotices.items.find(n => n.requestId === draft.id); assert.ok(notice && !notice.readAt);
  expect(await call(`/notifications/${notice.id}/read`, { token: second.accessToken, role: 'CBTD', method: 'POST' }), [403, 404], 'cannot mark another user notice');
  expect(await call(`/notifications/${notice.id}/read`, { token: manager.accessToken, role: 'QUAN_LY', method: 'POST' }), [200, 201], 'owner marks notice read');
  assert.ok((await prisma.internalNotification.findUnique({ where: { id: notice.id } })).readAt);
  expect(await call(`/portal/requests/${draft.id}`, { token, method: 'PUT', body: { data } }), [400, 409], 'submitted payload frozen');
  expect(await upload(draft.id, token, 'A', 'late.pdf', pdf), [400, 409], 'submitted documents frozen');
  for (const a of [actor, second]) {
    expect(await call(`/portal-intakes/${draft.id}`, { token: a.accessToken, role: 'CBTD' }), [403, 404], 'unassigned officer cannot read');
    expect(await call(`/portal-intakes/${draft.id}/accept`, { token: a.accessToken, role: 'CBTD', method: 'POST', body: {} }), [403, 404], 'unassigned officer cannot claim');
  }
  expect(await call(`/portal-intakes/${draft.id}/assign`, { token: actor.accessToken, role: 'CBTD', method: 'POST', body: { officerId: actor.user.id, expectedAssignedTo: null } }), 403, 'officer cannot self assign');
  const officers = expect(await call('/portal-intakes/officers', { token: manager.accessToken, role: 'QUAN_LY' }), 200, 'manager workload list');
  assert.ok(officers.some(o => o.id === staff.id && typeof o.activeLoanCount === 'number' && typeof o.pendingIntakeCount === 'number'));
  assert.ok(!officers.some(o => o.id === inactive.id));
  expect(await call(`/portal-intakes/${draft.id}/assign`, { token: manager.accessToken, role: 'QUAN_LY', method: 'POST', body: { officerId: inactive.id, expectedAssignedTo: null } }), 400, 'inactive officer rejected');
  expect(await call(`/portal-intakes/${draft.id}/assign`, { token: manager.accessToken, role: 'QUAN_LY', method: 'POST', body: { officerId: actor.user.id } }), 400, 'assignment requires concurrency token');
  const assignments = await Promise.all([manager, otherManager].map((m, i) => call(`/portal-intakes/${draft.id}/assign`, { token: m.accessToken, role: 'QUAN_LY', method: 'POST', body: { officerId: [actor, second][i].user.id, expectedAssignedTo: null, note: 'Initial fixture assignment' } })));
  assert.equal(assignments.filter(r => [200, 201].includes(r.status)).length, 1, 'one concurrent manager assignment wins');
  assert.equal(assignments.filter(r => r.status === 409).length, 1, 'stale manager assignment rejected');
  const assignmentIndex = assignments.findIndex(r => [200, 201].includes(r.status));
  const previousOfficer = [actor, second][assignmentIndex];
  const winner = [actor, second][1 - assignmentIndex];
  assert.equal(await prisma.portalAssignment.count({ where: { requestId: draft.id } }), 1);
  assert.equal(await prisma.loanApplication.count(), baselineLoanCount, 'assignment does not create loan or start SLA');
  const assignedPortal = expect(await call(`/portal/requests/${draft.id}`, { token }), 200, 'enterprise sees assigned status'); assert.equal(assignedPortal.status, 'ASSIGNED');
  expect(await call(`/portal-intakes/${draft.id}/assign`, { token: manager.accessToken, role: 'QUAN_LY', method: 'POST', body: { officerId: winner.user.id, expectedAssignedTo: previousOfficer.user.id } }), 400, 'reassignment reason required');
  expect(await call(`/portal-intakes/${draft.id}/assign`, { token: manager.accessToken, role: 'QUAN_LY', method: 'POST', body: { officerId: winner.user.id, expectedAssignedTo: null, note: 'Stale state' } }), 409, 'stale reassignment rejected');
  expect(await call(`/portal-intakes/${draft.id}/assign`, { token: manager.accessToken, role: 'QUAN_LY', method: 'POST', body: { officerId: winner.user.id, expectedAssignedTo: previousOfficer.user.id, note: 'Officer availability changed - test' } }), [200, 201], 'manager reassigns');
  const history = expect(await call(`/portal-intakes/${draft.id}/assignment-history`, { token: manager.accessToken, role: 'QUAN_LY' }), 200, 'assignment history'); assert.equal(history.length, 2);
  for (const suffix of ['', '/company-match', `/documents/${first.id}/download`]) expect(await call(`/portal-intakes/${draft.id}${suffix}`, { token: previousOfficer.accessToken, role: 'CBTD', raw: suffix.endsWith('/download') }), [403, 404], 'former officer loses request access');
  expect(await call(`/portal-intakes/${draft.id}/accept`, { token: previousOfficer.accessToken, role: 'CBTD', method: 'POST', body: {} }), [403, 404], 'former officer cannot accept');
  const officerNotices = expect(await call('/notifications', { token: winner.accessToken, role: 'CBTD' }), 200, 'assigned officer receives notice'); assert.ok(officerNotices.items.some(n => n.requestId === draft.id));
  const match = expect(await call(`/portal-intakes/${draft.id}/company-match`, { token: winner.accessToken, role: 'CBTD' }), 200, 'internal company matching'); assert.equal(match.found, true);
  expect(await call(`/portal-intakes/${draft.id}/accept`, { token: winner.accessToken, role: 'CBTD', method: 'POST', body: {} }), [400, 409], 'existing company requires explicit confirmation');
  const responses = await Promise.all([1, 2].map(() => call(`/portal-intakes/${draft.id}/accept`, { token: winner.accessToken, role: 'CBTD', method: 'POST', body: { confirmExistingCompany: true } })));
  assert.ok(responses.every(r => [200, 201].includes(r.status)), 'same officer concurrent retries are idempotent');
  const loanId = responses[0].data.loanId; assert.ok(loanId); assert.equal(responses[1].data.loanId, loanId);
  expect(await call(`/portal-intakes/${draft.id}/assign`, { token: manager.accessToken, role: 'QUAN_LY', method: 'POST', body: { officerId: previousOfficer.user.id, expectedAssignedTo: winner.user.id, note: 'Too late' } }), [400, 409], 'accepted request must use existing loan transfer flow');
  const accepted = expect(await call(`/portal-intakes/${draft.id}/accept`, { token: winner.accessToken, role: 'CBTD', method: 'POST', body: { confirmExistingCompany: true } }), [200, 201], 'same officer accept retry'); assert.equal(accepted.loanId, loanId);
  const loan = await prisma.loanApplication.findUniqueOrThrow({ where: { id: loanId }, include: { documents: true, stageHistories: true } });
  assert.equal(loan.currentStage, 'TIEP_NHAN'); assert.equal(loan.currentStatus, 'RECEIVED'); assert.equal(loan.assignedTo, winner.user.id); assert.equal(loan.documents.length, 6); assert.equal(loan.stageHistories.length, 1);
  const acceptedRequest = await prisma.portalRequest.findUniqueOrThrow({ where: { id: draft.id } });
  const intakeStage = await prisma.workflowStage.findUniqueOrThrow({ where: { stageCode: 'TIEP_NHAN' } });
  assert.notEqual(loan.id, draft.id, 'Request ID and Loan ID remain distinct');
  assert.equal(acceptedRequest.formVersion, 1); assert.equal(acceptedRequest.checklistVersion, 'legacy-v1');
  assert.equal(acceptedRequest.checklistSnapshot.documentIds.length, 6);
  assert.equal(loan.stageHistories[0].enteredAt.getTime(), acceptedRequest.acceptedAt.getTime(), 'SLA starts exactly on acceptance');
  assert.equal(loan.stageHistories[0].slaStandardHours, intakeStage.standardSlaHours);
  assert.equal(Number(loan.proposedAmount), data.proposedAmount); assert.equal(loan.loanTermMonths, data.loanTermMonths); assert.equal(loan.loanType, data.loanType); assert.equal(loan.loanPurpose, data.loanPurpose);
  assert.equal(createHash('sha256').update(JSON.stringify(await prisma.company.findUnique({ where: { id: company.id } }))).digest('hex'), companyHash, 'existing company never overwritten');
  const portalDownload = `/portal/requests/${draft.id}/documents/${first.id}/download`;
  const fileBefore = expect(await call(portalDownload, { token, raw: true }), 200, 'portal download after acceptance');
  const internalDoc = loan.documents.find(d => d.portalDocumentId === first.id); assert.ok(internalDoc);
  expect(await call(`/documents/${internalDoc.id}`, { token: winner.accessToken, role: 'CBTD', method: 'DELETE' }), 200, 'delete internal fixture metadata');
  const fileAfter = expect(await call(portalDownload, { token, raw: true }), 200, 'portal original survives internal deletion'); assert.deepEqual(fileAfter, fileBefore);
  const loser = previousOfficer;
  expect(await call(`/portal-intakes/${draft.id}`, { token: loser.accessToken, role: 'CBTD' }), [403, 404], 'accepted intake respects officer assignment');
  expect(await call(`/portal-intakes/${draft.id}/documents/${first.id}/download`, { token: loser.accessToken, role: 'CBTD', raw: true }), [403, 404], 'accepted intake file respects officer assignment');
  // Simulate an existing assignment transfer on this run's loan only.
  await prisma.loanApplication.update({ where: { id: loanId }, data: { assignedTo: loser.user.id } });
  expect(await call(`/portal-intakes/${draft.id}`, { token: winner.accessToken, role: 'CBTD' }), [403, 404], 'previous officer loses intake after transfer');
  expect(await call(`/portal-intakes/${draft.id}/documents/${first.id}/download`, { token: winner.accessToken, role: 'CBTD', raw: true }), [403, 404], 'previous officer loses file after transfer');
  expect(await call(`/portal-intakes/${draft.id}/accept`, { token: winner.accessToken, role: 'CBTD', method: 'POST', body: { confirmExistingCompany: true } }), [403, 404], 'accept retry cannot bypass transfer');
  expect(await call(`/portal-intakes/${draft.id}`, { token: loser.accessToken, role: 'CBTD' }), 200, 'current officer can read transferred intake');
  expect(await call(`/portal-intakes/${draft.id}/documents/${first.id}/download`, { token: loser.accessToken, role: 'CBTD', raw: true }), 200, 'current officer can read transferred file');
  const newData = { ...data, taxCode: String(Date.now()).slice(-10), companyName: `New ${tag}` };
  const newDraft = expect(await call('/portal/requests', { token, method: 'POST', body: { data: newData } }), [200, 201], 'new-company draft');
  for (const group of ['A', 'B', 'C', 'D', 'E', 'F']) expect(await upload(newDraft.id, token, group, `${group}.pdf`, pdf), [200, 201], `new-company group ${group}`);
  expect(await call(`/portal/requests/${newDraft.id}/submit`, { token, method: 'POST' }), [200, 201], 'new-company submit');
  expect(await call(`/portal-intakes/${newDraft.id}/assign`, { token: manager.accessToken, role: 'QUAN_LY', method: 'POST', body: { officerId: actor.user.id, expectedAssignedTo: null } }), [200, 201], 'manager assigns new-company request');
  const newMatch = expect(await call(`/portal-intakes/${newDraft.id}/company-match`, { token: actor.accessToken, role: 'CBTD' }), 200, 'new-company match'); assert.equal(newMatch.found, false);
  const newAccepted = expect(await call(`/portal-intakes/${newDraft.id}/accept`, { token: actor.accessToken, role: 'CBTD', method: 'POST', body: {} }), [200, 201], 'accept new company without confirmation field');
  const createdLoan = await prisma.loanApplication.findUniqueOrThrow({ where: { id: newAccepted.loanId } }); owned.companies.push(createdLoan.companyId);
  assert.equal(await prisma.company.count({ where: { taxCode: newData.taxCode } }), 1);
}

(async () => {
  let failure;
  try { await main(); } catch (error) { failure = error; }
  try { await cleanup(); } catch (error) { failure ||= error; }
  await prisma?.$disconnect();
  if (failure) { console.error(failure.message); process.exitCode = 1; }
  else console.log(JSON.stringify({ pass: true, httpChecks: assertions, cleanup: true, scope: 'Local SMTP + PostgreSQL + HTTP; assignment, notifications, acceptance; tagged fixtures only' }));
})();
