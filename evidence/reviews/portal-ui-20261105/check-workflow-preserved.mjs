import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../frontend/package.json', import.meta.url));
const ts = require('typescript');
const source = await readFile(new URL('../../../frontend/src/portal/PortalWizard.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('PortalWizard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const baseline = JSON.parse(await readFile(new URL('./workflow-baseline.json', import.meta.url), 'utf8'));
const actual = {};
function visit(node) {
  if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && Object.hasOwn(baseline, node.name.getText(ast))) actual[node.name.getText(ast)] = createHash('sha256').update(node.getText(ast)).digest('hex');
  ts.forEachChild(node, visit);
}
visit(ast);
const checks = Object.entries(baseline).map(([symbol, hash]) => ({ symbol, unchanged: actual[symbol] === hash }));
await writeFile(new URL('./workflow-results.json', import.meta.url), JSON.stringify({ method: 'SHA256 of the TypeScript AST node source, compared with pre-edit baseline', checks }, null, 2));
console.log(JSON.stringify(checks, null, 2));
assert.ok(checks.every(item => item.unchanged), 'Existing workflow handlers and canSendApproved must remain unchanged');
