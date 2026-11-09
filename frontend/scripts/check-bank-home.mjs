import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../src/components/BankHome.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('the Enterprise lending entries on the bank home lead to the enterprise portal', () => {
  assert.match(home, /PORTAL_PATH = '\/portal'/);
  assert.ok((home.match(/href=\{PORTAL_PATH\}/g) ?? []).length >= 5, 'banner, top bar, header, cards and guide all link to the portal');
  assert.match(home, /id="doanh-nghiep"/);
  assert.match(home, /Vay vốn doanh nghiệp/);
});

test('the public home does not advertise the internal staff login; staff use a separate address', () => {
  assert.match(home, /STAFF_LOGIN_PATH = '\/noi-bo'/);
  assert.ok(!/href=\{STAFF_LOGIN_PATH\}/.test(home) && !home.includes('href="/noi-bo"'), 'no link to the staff login on the public page');
  assert.ok(!/Cán bộ đăng nhập/.test(home));
  assert.ok(app.includes("window.location.pathname === '/' ? <BankHome /> : <LoginPage />"));
  assert.ok(app.includes("window.location.pathname === '/noi-bo'"));
});

test('only the Enterprise tile is active; the other tiles are symbolic and not links', () => {
  const tiles = home.match(/const TILES = \[[\s\S]*?\];/)[0];
  assert.equal((tiles.match(/href:/g) ?? []).length, 1);
  assert.match(tiles, /Doanh nghiệp', icon: Briefcase, href/);
});
