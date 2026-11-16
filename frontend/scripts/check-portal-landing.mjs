import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const landing = await readFile(new URL('../src/portal/PortalLanding.tsx', import.meta.url), 'utf8');
const portal = await readFile(new URL('../src/portal/PortalApp.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('the landing layer sits in front of the portal sign-in and every lending entry opens it', () => {
  assert.ok((landing.match(/href=\{ENTER_HASH\} onClick=\{enter\}/g) ?? []).length >= 5, 'banner, top bar, header, cards and guide');
  assert.match(portal, /if \(!resetToken && !entered\) return <PortalLanding/);
  assert.match(landing, /Vay vốn doanh nghiệp/);
});

test('opening /portal always shows the landing page first, even with a saved enterprise session', () => {
  assert.match(portal, /useState\(\(\) => location\.hash === ENTER_HASH \|\| new URL\(location\.href\)\.searchParams\.has\('reset'\)\)/);
  assert.match(portal, /const expired = \(\) => \{ clearView\(\);/);
  assert.match(portal, /const changed = \(\) => \{ clearView\(\);/);
});

test('password reset links go straight to the reset form and stay in the portal after the reset', () => {
  assert.match(portal, /!resetToken/);
  assert.match(portal, /searchParams\.has\('reset'\)/);
});

test('the bank staff side keeps its own login at the root and the landing page links nothing internal', () => {
  assert.ok(app.includes('if (!user) return <LoginPage />;'));
  assert.ok(!app.includes('PortalLanding') && !app.includes('BankHome'));
  assert.ok(!/noi-bo|STAFF_LOGIN|Cán bộ đăng nhập/.test(landing));
});

test('only the Enterprise tile is active; the other tiles are symbolic and not links', () => {
  const tiles = landing.match(/const TILES = \[[\s\S]*?\];/)[0];
  assert.equal((tiles.match(/href:/g) ?? []).length, 1);
});
