import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Exercise real validator failures on disposable copies, never on the checkout.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = 'sme-loan-ai-rule-fixture-';
const base = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const fixture = path.join(base, 'repo');
const inventory = JSON.parse(fs.readFileSync(path.join(repo, 'docs/ai/skills-inventory.json'), 'utf8'));
const sources = [
  'AGENTS.md', 'GEMINI.md', 'Project.md', 'README.md', 'docker-compose.yml',
  'start-local.ps1', 'run-local-dev.ps1',
  '.agents/AGENTS.md', '.agents/AI-SETUP.md', '.agents/skills.json',
  '.agents/rules', '.agents/workflow', 'docs/ai',
  'docs/Phan_quyen_va_luong_nghiep_vu.md',
  'docs/Dac_ta_chi_tiet_Use_Case_SME_Loan.md',
  'docs/Thiet_ke_Co_so_du_lieu_SME_Loan.md',
  'docs/Bao_cao_Mo_hinh_Machine_Learning.md',
  'backend/package.json', 'backend/prisma/schema.prisma', 'backend/src',
  'frontend/package.json', 'frontend/src',
  'ml-service/requirements.txt', 'ml-service/app/main.py',
  'ml-service/app/schemas.py', 'ml-service/app/predictor.py',
  'ml-service/app/model/model_metadata.json',
  'scripts/check-ai-rules.mjs', 'scripts/check-ai-rules.test.mjs',
  'package.json', 'package-lock.json', '.codegraphrc.json', 'scripts/check-codegraph.mjs', 'scripts/check-codegraph.test.mjs',
  'scripts/run-codegraph.mjs',
  ...inventory.skills.map(item => item.path),
];
let cases = 0;
try {
  for (const relative of sources) {
    const source = path.resolve(repo, relative);
    const destination = path.resolve(fixture, relative);
    assert(!path.relative(repo, source).startsWith('..'));
    assert(!path.relative(fixture, destination).startsWith('..'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
  }
  function run(name, expectedExit, diagnostic) {
    const result = spawnSync(process.execPath, [path.join(repo, 'scripts/check-ai-rules.mjs'), fixture], { encoding: 'utf8' });
    assert.equal(result.status, expectedExit, `${name}: ${result.stdout}\n${result.stderr}`);
    if (diagnostic) assert(result.stdout.includes(diagnostic), `${name}: missing expected diagnostic`);
    cases++;
    console.log(`PASS ${name}`);
  }
  function modify(relative, transform, name, diagnostic) {
    const file = path.join(fixture, relative);
    const original = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, transform(original));
    try { run(name, 1, diagnostic); } finally { fs.writeFileSync(file, original); }
  }
  run('Valid configuration accepted', 0);
  const entry = path.join(fixture, 'AGENTS.md');
  const original = fs.readFileSync(entry);
  fs.unlinkSync(entry);
  try { run('Missing Codex entrypoint rejected', 1, 'FAIL Nonempty file: AGENTS.md'); }
  finally { fs.writeFileSync(entry, original); }
  modify('.agents/rules/ai-rules.md', text => text.replace('trigger: always_on', 'trigger: alwaysOn'),
    'Invalid Antigravity trigger rejected', 'FAIL Valid Antigravity trigger: ai-rules.md');
  modify('.agents/skills.json', text => {
    const data = JSON.parse(text);
    data.task_routes.find(route => route.type === 'planning').skills[0] = '.agents/skills/missing/SKILL.md';
    return JSON.stringify(data);
  }, 'Missing routed skill rejected', 'FAIL Skill exists (planning)');
  modify('AGENTS.md', text => `${text}\n[Broken local source](missing-policy.md)\n`,
    'Broken local link rejected', 'FAIL Local link in AGENTS.md: missing-policy.md');
  modify(inventory.skills[0].path, text => `${text}\nChanged vendor fixture\n`,
    'Vendor integrity mismatch rejected', 'FAIL Vendor skill unchanged:');
  modify('.agents/rules/ai-rules.md', text => text.replace('trigger: always_on', 'trigger: model_decision') + '\nExample in body:\ntrigger: always_on\n',
    'Body cannot spoof bootstrap trigger', 'FAIL Always-on module: ai-rules');
  modify('.agents/skills.json', text => {
    const data = JSON.parse(text);
    data.required_tools.codegraph = 'optional';
    return JSON.stringify(data);
  }, 'CodeGraph cannot be downgraded to optional', 'FAIL CodeGraph is required for code tasks');
  modify('.agents/AGENTS.md', text => text.replace(/## SME-AI-011[^]*?(?=## SME-AI-012)/, ''),
    'Missing PO hard rule rejected', 'FAIL Core defines SME-AI-011');
  modify('.agents/AGENTS.md', text => text.replace(/(## SME-AI-012[^\n]*\n)[^]*/, '$1'),
    'Empty recursive impact rule rejected', 'FAIL Core defines SME-AI-012');
  modify('AGENTS.md', text => text.replaceAll('SME-AI-011', 'REMOVED-011'),
    'Codex cannot omit hard-rule wiring', 'FAIL Hard rules and impact workflow wired: AGENTS.md');
  modify('GEMINI.md', text => text.replaceAll('SME-AI-012', 'REMOVED-012'),
    'Gemini cannot omit hard-rule wiring', 'FAIL Hard rules and impact workflow wired: GEMINI.md');
  modify('.agents/skills.json', text => {
    const data = JSON.parse(text);
    data.hard_rules['SME-AI-011'].po_approval_before_alternative = false;
    return JSON.stringify(data);
  }, 'Unapproved alternatives rejected', 'FAIL PO approval required before an alternative');
  modify('.agents/skills.json', text => {
    const data = JSON.parse(text);
    data.hard_rules['SME-AI-011'].scope_expansion_requires_po = false;
    return JSON.stringify(data);
  }, 'Unapproved scope expansion rejected', 'FAIL PO approval required before scope expansion');
  modify('.agents/skills.json', text => {
    const data = JSON.parse(text);
    data.hard_rules['SME-AI-012'].order.reverse();
    return JSON.stringify(data);
  }, 'Depth-first impact order rejected', 'FAIL Impact analysis runs horizontal then depth');
  modify('.agents/skills.json', text => {
    const data = JSON.parse(text);
    data.hard_rules['SME-AI-012'].transitive = false;
    return JSON.stringify(data);
  }, 'Direct-only impact analysis rejected', 'FAIL Impact analysis includes transitive dependencies');
  modify('.agents/workflow/impact-analysis.md', () => '',
    'Missing impact workflow rejected', 'FAIL Nonempty file: .agents/workflow/impact-analysis.md');
  run('Restored configuration accepted', 0);
  console.log(`RESULT validator_integration_cases=${cases} failed=0`);
} finally {
  // Verify the final absolute deletion target stays in the named temp directory.
  const resolved = path.resolve(base);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert(path.basename(resolved).startsWith(prefix));
  fs.rmSync(resolved, { recursive: true, force: true });
}
