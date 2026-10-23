import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { codegraphEnvironment } from './run-codegraph.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = 'sme-codegraph-fixture-';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
let cases = 0;
try {
  const inherited = { PATH: process.env.PATH, CODEGRAPH_LLM_PROVIDER: 'fixture', CODEGRAPH_USER_CONFIG: 'outside', codegraph_llm_provider: 'mixed-case-fixture', No_Update_Check: '0', NO_UPDATE_CHECK: '' };
  const isolated = codegraphEnvironment(temp, inherited);
  assert.equal(isolated.NO_UPDATE_CHECK, '1');
  assert.equal(isolated.CODEGRAPH_LLM_PROVIDER, undefined);
  assert.equal(isolated.CODEGRAPH_USER_CONFIG, undefined);
  assert.equal(isolated.codegraph_llm_provider, undefined);
  assert.equal(isolated.No_Update_Check, undefined);
  assert.equal(isolated.CODEGRAPH_REGISTRY_PATH, path.join(temp, '.codegraph/registry.json'));
  assert.equal(isolated.CODEGRAPH_UPDATE_CACHE_PATH, path.join(temp, '.codegraph/update-check.json'));
  assert.equal(inherited.CODEGRAPH_LLM_PROVIDER, 'fixture');
  cases++;
  console.log('PASS Child process disables update checks and isolates CodeGraph environment');
  const forbiddenCommand = spawnSync(process.execPath, [path.join(repo, 'scripts/run-codegraph.mjs'), 'mcp'], { encoding: 'utf8' });
  assert.equal(forbiddenCommand.status, 1);
  assert(forbiddenCommand.stderr.includes('CODEGRAPH BLOCKED'));
  cases++;
  console.log('PASS Structural query wrapper rejects server command');
  for (const option of ['-d./.codegraph/graph.db', '-jd./.codegraph/graph.db', '--db=./.codegraph/graph.db']) {
    const result = spawnSync(process.execPath, [path.join(repo, 'scripts/run-codegraph.mjs'), 'stats', option, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 1, `DB override must be rejected: ${option}`);
    assert(result.stderr.includes('CODEGRAPH BLOCKED'));
  }
  cases++;
  console.log('PASS Joined, combined and long database overrides rejected');
  for (const file of ['package.json', 'package-lock.json', '.codegraphrc.json', '.gitignore']) fs.copyFileSync(path.join(repo, file), path.join(temp, file));
  function write(relative, content) {
    const file = path.resolve(temp, relative);
    assert(!path.relative(temp, file).startsWith('..'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  write('backend/src/sample.ts', 'export function value() { return 1; }\nexport function useValue() { return value(); }\n');
  write('frontend/src/View.tsx', 'export function View() { return <main>Fixture</main>; }\n');
  write('ml-service/app/sample.py', 'def predict(value):\n    return value * 2\n');
  const forbidden = ['.env', '.vault/private.ts', '.agents/private.ts', 'frontend/node_modules/private.ts', 'ml-service/data/private.py'];
  for (const file of forbidden) write(file, 'fixture_only = 1\n');
  function run(name, build, expected, diagnostic = '') {
    const args = [path.join(repo, 'scripts/check-codegraph.mjs'), '--root', temp];
    if (build) args.push('--build');
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, expected, `${name}: ${result.stdout}\n${result.stderr}`);
    if (diagnostic) assert((result.stdout + result.stderr).includes(diagnostic), `${name}: diagnostic missing`);
    cases++;
    console.log(`PASS ${name}`);
  }
  run('Missing index rejected', false, 1, 'CODEGRAPH BLOCKED');
  run('Real CodeGraph build on three-module fixture', true, 0, 'CODEGRAPH OK');
  run('Fresh source accepted', false, 0);
  write('backend/src/sample.ts', 'export function value() { return 2; }\nexport function useValue() { return value(); }\n');
  run('Changed source rejected', false, 1, 'Graph cũ so với source');
  run('Refresh accepts changed source', true, 0);
  write('backend/src/added.ts', 'export function added() { return 3; }\n');
  run('New source rejected until indexed', false, 1, 'Source mới/chưa index');
  run('Refresh indexes new source', true, 0);
  fs.unlinkSync(path.join(temp, 'backend/src/added.ts'));
  run('Deleted source rejected until refreshed', false, 1, 'Graph chứa file đã xoá/ngoài allowlist');
  run('Refresh removes deleted source', true, 0);
  const configPath = path.join(temp, '.codegraphrc.json');
  const originalConfig = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(originalConfig);
  config.query.defaultDepth = 2;
  fs.writeFileSync(configPath, JSON.stringify(config));
  run('Configuration drift rejected', false, 1, 'Config/package/lock/ignore đã đổi');
  fs.writeFileSync(configPath, originalConfig);
  run('Restored configuration accepted', false, 0);
  const packagePath = path.join(repo, 'node_modules/@optave/codegraph/package.json');
  const Database = createRequire(packagePath)('better-sqlite3');
  const db = new Database(path.join(temp, '.codegraph/graph.db'), { readonly: true, fileMustExist: true });
  try {
    const indexed = db.prepare('SELECT file FROM file_hashes').all().map(row => row.file.replaceAll('\\', '/'));
    assert.equal(indexed.length, 3);
    for (const file of forbidden) assert(!indexed.includes(file));
    cases++;
    console.log('PASS Private, vendor and data fixtures excluded from actual graph');
  } finally { db.close(); }
  console.log(`RESULT codegraph_integration_cases=${cases} failed=0`);
} finally {
  const resolved = path.resolve(temp);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert(path.basename(resolved).startsWith(prefix));
  fs.rmSync(resolved, { recursive: true, force: true });
}
