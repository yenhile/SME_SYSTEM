import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');

test('cross-tab sync logs out only when the token is removed, never when another tab logs in', () => {
  const handler = source.match(/const sync = \(event: StorageEvent\) => \{([^}]*)\}/)?.[1] ?? '';
  assert.match(handler, /event\.newValue === null/);
  assert.match(handler, /event\.key === 'sme_token'/);
  assert.doesNotMatch(handler, /if \(event\.key === 'sme_token'\) logout\(\)/);
});
