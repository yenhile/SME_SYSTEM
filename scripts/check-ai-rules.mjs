import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Static and read-only: never starts AI, npm, Docker, API or database code.
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const root = path.resolve(args.find(arg => arg !== '--verbose') ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) passed++; else failed++;
  if (!condition || verbose) console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`);
}
function resolveInside(relative, base = root) {
  const absolute = path.resolve(base, relative);
  const within = path.relative(root, absolute);
  if (within === '..' || within.startsWith(`..${path.sep}`) || path.isAbsolute(within)) {
    throw new Error(`Path leaves repository: ${relative}`);
  }
  return absolute;
}
function read(relative) {
  const file = resolveInside(relative);
  return fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8') : '';
}
function json(relative) { return JSON.parse(read(relative)); }
function sha256(relative) { return createHash('sha256').update(fs.readFileSync(resolveInside(relative))).digest('hex'); }

const required = [
  'AGENTS.md', 'GEMINI.md', 'Project.md',
  '.agents/AGENTS.md', '.agents/AI-SETUP.md', '.agents/skills.json',
  '.agents/workflow/preflight.md', '.agents/workflow/quick-ref.md', '.agents/workflow/impact-analysis.md',
  '.agents/rules/ai-rules.md', '.agents/rules/ai-delivery-workflow.md',
  '.agents/rules/karpathy-guidelines.md', '.agents/rules/data-security.md',
  'docs/ai/2026-10-18-audit-and-plan.md', 'docs/ai/PO-REVIEW.md',
  'docs/ai/acceptance-scenarios.json', 'docs/ai/skills-inventory.json',
  'docs/ai/original-rules.json',
  'package.json', 'package-lock.json', '.codegraphrc.json',
  'scripts/check-codegraph.mjs', 'scripts/run-codegraph.mjs', 'docs/ai/2026-10-18-codegraph.md',
];
for (const file of required) check(read(file).trim().length > 0, `Nonempty file: ${file}`);

const entry = read('AGENTS.md');
const gemini = read('GEMINI.md');
const core = read('.agents/AGENTS.md');
check(entry.includes('.agents/AGENTS.md') && entry.includes('Project.md'), 'Codex entry references policy and context');
check(gemini.includes('AGENTS.md') && gemini.includes('.agents/AGENTS.md'), 'Gemini entry references the same policy');
check([entry, gemini, core].every(text => !text.startsWith('---')), 'AGENTS and GEMINI have no rule frontmatter');
check(Buffer.byteLength(entry + gemini + core) < 24000, 'Combined entry and core text below local 24 KB budget');
const ids = Array.from({ length: 12 }, (_, i) => `SME-AI-${String(i + 1).padStart(3, '0')}`);
for (const id of ids) {
  const section = core.split(new RegExp(`^## ${id}[^\\n]*\\n`, 'm'))[1]?.split(/^## /m)[0];
  check(Boolean(section?.trim().length >= 120), `Core defines ${id}`);
}
for (const file of ['AGENTS.md', 'GEMINI.md', '.agents/rules/ai-rules.md',
  '.agents/workflow/preflight.md', '.agents/workflow/quick-ref.md', '.agents/rules/ai-delivery-workflow.md']) {
  const text = read(file);
  check(['SME-AI-011', 'SME-AI-012', 'impact-analysis.md'].every(part => text.includes(part)),
    `Hard rules and impact workflow wired: ${file}`);
}

const active = required.filter(file => file.endsWith('.md') && !file.startsWith('docs/'));
const stale = /ManagementFinance|Personal_Finance_Management|src\/Backend|src\/Admin-web|src\/Client-app|\/memories\/repo\/|docs\/Rule_Project\/Data_Security\.md|code-review-expert|file:\/\/\//;
for (const file of required.filter(file => file.endsWith('.md'))) {
  const text = read(file);
  if (active.includes(file)) check(!stale.test(text), `No obsolete references: ${file}`);
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '');
    if (/^(https?:\/\/|#)/.test(target)) continue;
    try {
      const relative = decodeURIComponent(target.split('#')[0]);
      check(fs.existsSync(resolveInside(relative, path.dirname(resolveInside(file)))), `Local link in ${file}: ${target}`);
    } catch (error) { check(false, `Local link in ${file}: ${error.message}`); }
  }
}

const rulesDir = resolveInside('.agents/rules');
const rules = fs.existsSync(rulesDir) ? fs.readdirSync(rulesDir).filter(file => file.endsWith('.md')) : [];
const ruleTriggers = new Map();
check(rules.length >= 4, 'At least four project rule modules');
for (const file of rules) {
  const front = read(`.agents/rules/${file}`).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const yaml = front?.[1] ?? '';
  const trigger = yaml.match(/^trigger: (always_on|model_decision|glob|manual)\s*$/m)?.[1];
  ruleTriggers.set(file, trigger);
  check(Boolean(trigger), `Valid Antigravity trigger: ${file}`);
  check(/^description: .+/m.test(yaml), `Rule description: ${file}`);
}
for (const name of ['ai-rules', 'data-security']) {
  check(ruleTriggers.get(`${name}.md`) === 'always_on', `Always-on module: ${name}`);
}

try {
  const manifest = json('.agents/skills.json');
  check(manifest.project === 'sme-loan-workflow' && manifest.format_version === 2, 'Routing manifest identifies SME Loan v2');
  check(manifest.discovery === 'project-routing-index-not-host-configuration', 'Manifest discloses routing versus discovery');
  check(manifest.optional_tools?.rtk === 'optional' && manifest.optional_tools?.codegraph === undefined, 'Only RTK is optional');
  check(manifest.required_tools?.codegraph === 'required-for-code-tasks', 'CodeGraph is required for code tasks');
  const po = manifest.hard_rules?.['SME-AI-011'];
  const impact = manifest.hard_rules?.['SME-AI-012'];
  check(po?.po_approval_before_alternative === true, 'PO approval required before an alternative');
  check(po?.scope_expansion_requires_po === true, 'PO approval required before scope expansion');
  check(JSON.stringify(impact?.order) === JSON.stringify(['horizontal', 'depth']), 'Impact analysis runs horizontal then depth');
  check(impact?.transitive === true, 'Impact analysis includes transitive dependencies');
  check(impact?.workflow === '.agents/workflow/impact-analysis.md', 'Impact workflow route is explicit');
  const tooling = json('package.json');
  const lock = json('package-lock.json');
  const config = json('.codegraphrc.json');
  check(tooling.devDependencies?.['@optave/codegraph'] === '3.17.0' && lock.packages?.['node_modules/@optave/codegraph']?.version === '3.17.0', 'CodeGraph package and lock pin 3.17.0');
  check(tooling.scripts?.['graph:build'] === 'node scripts/check-codegraph.mjs --build' && tooling.scripts?.['graph:check'] === 'node scripts/check-codegraph.mjs', 'Build and freshness commands are configured');
  check(tooling.scripts?.codegraph === 'node scripts/check-codegraph.mjs && node scripts/run-codegraph.mjs', 'CLI queries enforce freshness and isolated local execution');
  check(config.build?.dbPath === '.codegraph/graph.db' && config.ignoreDirs?.includes('.agents') && config.ignoreDirs?.includes('.vault') && config.ignoreDirs?.includes('.dump'), 'Graph has local output and protected exclusions');
  for (const item of manifest.entries) {
    check(fs.existsSync(resolveInside(item.path)) && fs.statSync(resolveInside(item.path)).isDirectory(), `Library exists: ${item.path}`);
  }
  check(Array.isArray(manifest.task_routes) && manifest.task_routes.length >= 8, 'At least eight task routes');
  for (const route of manifest.task_routes) {
    for (const skill of route.skills) {
      const text = read(skill);
      check(text.trim().length > 0, `Skill exists (${route.type}): ${skill}`);
      check(!/\/(deprecated|in-progress|personal)\//.test(skill), `Default route uses supported bucket: ${skill}`);
      check(/^name: .+/m.test(text) && /^description: .+/m.test(text), `Routed skill metadata: ${skill}`);
    }
  }
} catch (error) { check(false, `Routing manifest: ${error.message}`); }

try {
  const inventory = json('docs/ai/skills-inventory.json');
  check(inventory.skills.length === 56, 'Original inventory contains 56 skills');
  for (const skill of inventory.skills) {
    check(read(skill.path).length > 0 && sha256(skill.path) === skill.sha256.toLowerCase(), `Vendor skill unchanged: ${skill.name} [${skill.bucket}]`);
  }
} catch (error) { check(false, `Skill inventory: ${error.message}`); }

try {
  const set = json('docs/ai/acceptance-scenarios.json');
  check(set.scenarios.length >= 18, 'At least eighteen acceptance scenarios');
  check(set.version === 'sme-loan-ai-v1.2', 'Acceptance scenarios use current policy version');
  for (const id of ['SME-AI-011', 'SME-AI-012']) {
    check(set.scenarios.filter(item => item.policy_ids.includes(id)).length >= 3, `Hard rule has acceptance coverage: ${id}`);
  }
  check(new Set(set.scenarios.map(item => item.id)).size === set.scenarios.length, 'Unique scenario IDs');
  check(set.validation_kind === 'manual-host-smoke-and-simulation', 'Scenarios disclose manual and simulated scope');
  for (const scenario of set.scenarios) {
    check(scenario.prompt?.trim().length > 0 && scenario.expected?.length > 0, `Scenario expectations: ${scenario.id}`);
    for (const id of scenario.policy_ids) check(ids.includes(id), `Scenario policy: ${scenario.id} -> ${id}`);
  }
} catch (error) { check(false, `Acceptance scenarios: ${error.message}`); }

console.log(`RESULT passed=${passed} failed=${failed}`);
console.log('Scope: static configuration and SKILL.md integrity; no live AI, Antigravity or application test.');
process.exitCode = failed > 0 ? 1 : 0;
