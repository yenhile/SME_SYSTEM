const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const file = path.resolve(__dirname, '../src/common/document-codes.ts');
let rules = {};
if (fs.existsSync(file)) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText)(require, module, module.exports);
  rules = module.exports;
}

test('DN and SME use independent database counters, without date or zero padding', async () => {
  assert.equal(typeof rules.nextDocumentCode, 'function');
  const queries = [];
  const tx = { $queryRaw: async parts => { const query = parts.join(''); queries.push(query); return [{ value: query.includes('portal_request_reference_seq') ? '1' : '27' }]; } };
  assert.equal(await rules.nextDocumentCode(tx, 'DN'), 'DN-1');
  assert.equal(await rules.nextDocumentCode(tx, 'SME'), 'SME-27');
  assert.ok(queries.every(q => /nextval\(/.test(q)));
  assert.match(queries[1], /loan_application_code_seq/);
});

test('database bigint identifiers never lose precision through JavaScript Number', async () => {
  assert.equal(typeof rules.nextDocumentCode, 'function');
  assert.equal(await rules.nextDocumentCode({ $queryRaw: async () => [{ value: '9007199254740993' }] }, 'DN'), 'DN-9007199254740993');
});

test('invalid or unavailable counters fail closed instead of falling back to random codes', async () => {
  assert.equal(typeof rules.nextDocumentCode, 'function');
  for (const rows of [[], [{ value: '0' }], [{ value: '01' }], [{ value: '-1' }], [{ value: '1.5' }], [{ value: 1 }]]) {
    await assert.rejects(rules.nextDocumentCode({ $queryRaw: async () => rows }, 'DN'));
  }
  const unavailable = new Error('database unavailable');
  await assert.rejects(rules.nextDocumentCode({ $queryRaw: async () => { throw unavailable; } }, 'DN'), e => e === unavailable);
  await assert.rejects(rules.nextDocumentCode({ $queryRaw: async () => [{ value: '1' }] }, 'OTHER'));
});
