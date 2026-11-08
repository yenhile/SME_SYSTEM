import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/userPreferences.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const prefs = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('stored preferences are validated: unknown or broken values fall back to the default', () => {
  assert.deepEqual(prefs.normalizePreferences({ fontScale: 112 }), { fontScale: 112 });
  assert.deepEqual(prefs.normalizePreferences({ fontScale: 300 }), { fontScale: 100 });
  assert.deepEqual(prefs.normalizePreferences(null), { fontScale: 100 });
  assert.deepEqual(prefs.loadPreferences({ getItem: () => '{not json' }), { fontScale: 100 });
  assert.deepEqual(prefs.loadPreferences({ getItem: () => JSON.stringify({ fontScale: 125 }) }), { fontScale: 125 });
  assert.deepEqual(prefs.loadPreferences(undefined), { fontScale: 100 });
});

test('saving writes only the validated value, and a blocked storage does not throw', () => {
  const written = {};
  prefs.savePreferences({ fontScale: 112 }, { setItem: (key, value) => { written[key] = value; } });
  assert.deepEqual(JSON.parse(written[prefs.PREFERENCES_KEY]), { fontScale: 112 });
  prefs.savePreferences({ fontScale: 7 }, { setItem: (key, value) => { written[key] = value; } });
  assert.deepEqual(JSON.parse(written[prefs.PREFERENCES_KEY]), { fontScale: 100 });
  assert.doesNotThrow(() => prefs.savePreferences({ fontScale: 112 }, { setItem: () => { throw new Error('blocked'); } }));
});

test('font scale is applied to the page root and cleared for the default', () => {
  const root = { style: { fontSize: '' } };
  prefs.applyPreferences({ fontScale: 125 }, root);
  assert.equal(root.style.fontSize, '125%');
  prefs.applyPreferences({ fontScale: 100 }, root);
  assert.equal(root.style.fontSize, '');
});
