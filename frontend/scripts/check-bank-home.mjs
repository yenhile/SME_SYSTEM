import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../src/components/BankHome.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('the Enterprise lending entries on the bank home lead to the enterprise portal', () => {
  assert.match(home, /PORTAL_PATH = '\/portal'/);
  assert.ok((home.match(/href=\{PORTAL_PATH\}/g) ?? []).length >= 5, 'vay von, theo doi ho so, o tim kiem, nut bat dau');
  assert.match(home, /id="doanh-nghiep"/);
  assert.match(home, /Vay vốn doanh nghiệp/);
});

test('staff reach the internal login only through the Login button and keep deep links on the login page', () => {
  assert.match(home, /STAFF_LOGIN_HREF = '\/\?dang-nhap=1'/);
  assert.match(app, /pathname === '\/' && !window\.location\.search\.includes\('dang-nhap'\) \? <BankHome \/> : <LoginPage \/>/);
});
