import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const self = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(self), '..');

export function codegraphEnvironment(root, base = process.env) {
  const env = { ...base };
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if (upper.startsWith('CODEGRAPH_') || upper === 'NO_UPDATE_CHECK') delete env[key];
  }
  env.NO_UPDATE_CHECK = '1';
  env.CODEGRAPH_REGISTRY_PATH = path.join(root, '.codegraph/registry.json');
  env.CODEGRAPH_UPDATE_CACHE_PATH = path.join(root, '.codegraph/update-check.json');
  return env;
}

export function runCodegraph(args, root = repo) {
  const cli = path.join(repo, 'node_modules/@optave/codegraph/dist/cli.js');
  return spawnSync(process.execPath, [cli, '--no-user-config', ...args], {
    cwd: root,
    env: codegraphEnvironment(root),
    stdio: 'inherit',
  });
}

const invocation = process.argv[1] ? path.resolve(process.argv[1]) : '';
const samePath = process.platform === 'win32' ? invocation.toLowerCase() === self.toLowerCase() : invocation === self;
if (samePath) {
  const args = process.argv.slice(2);
  const structural = new Set(['stats', 'where', 'context', 'deps', 'fn-impact', 'impact', 'brief', 'query', 'map', 'roles']);
  const shortOptions = new Set(['-j', '-T', '-f', '-n', '-k', '-h']);
  const unsafeOption = args.some(arg => /^(--user-config|--db)(=|$)/.test(arg) || (/^-[^-]/.test(arg) && !shortOptions.has(arg)));
  if (!structural.has(args[0]) || unsafeOption) {
    console.error('CODEGRAPH BLOCKED: wrapper chỉ cho truy vấn cấu trúc trên graph của repo; không bật server/provider hoặc đổi config/db.');
    process.exitCode = 1;
  } else {
    const result = runCodegraph(args);
    if (result.error) console.error(`CODEGRAPH BLOCKED: ${result.error.message}`);
    process.exitCode = result.status ?? 1;
  }
}
