import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runCodegraph } from './run-codegraph.mjs';

// This adapter is tested against the pinned CodeGraph 3.17.0 SQLite schema.
// It reads source and the local graph only; --build refreshes that graph cache.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const build = args.includes('--build');
const rootArg = args.indexOf('--root');
const root = rootArg >= 0 ? path.resolve(args[rootArg + 1] ?? '') : repo;
const sourceRoots = ['backend/src', 'frontend/src', 'ml-service/app', 'ml-service/scripts', 'backend/scripts', 'scripts'];
const protectedDirs = ['node_modules', '.git', '.agents', '.codex', '.aws', '.codegraph', '.dump', '.vault', '.venv', 'venv', '__pycache__', 'uploads', 'data', 'model', 'dist', 'build', 'coverage'];
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const normalized = value => value.replaceAll('\\', '/');
const fail = message => { throw new Error(message); };

try {
  const configPath = path.join(root, '.codegraphrc.json');
  const config = readJson(configPath);
  const pkg = readJson(path.join(root, 'package.json'));
  const packagePath = path.join(repo, 'node_modules/@optave/codegraph/package.json');
  if (!fs.existsSync(packagePath)) fail('CodeGraph chưa được cài. Chạy npm ci tại root đã được PO cho phép.');
  const tool = readJson(packagePath);
  if (tool.version !== '3.17.0' || pkg.devDependencies?.['@optave/codegraph'] !== tool.version) fail('Phiên bản CodeGraph không khớp bản ghim 3.17.0.');
  const expectedPatterns = sourceRoots.map(dir => `${dir}/**`).sort();
  if (JSON.stringify([...(config.include ?? [])].sort()) !== JSON.stringify(expectedPatterns)) fail('Allowlist source thay đổi; phải review adapter và config trước khi index.');
  for (const dir of protectedDirs) if (!config.ignoreDirs?.includes(dir)) fail(`Thiếu ignore directory: ${dir}`);
  if (config.build?.dbPath !== '.codegraph/graph.db') fail('Graph phải nằm tại .codegraph/graph.db của đúng repo.');
  if (config.llm?.provider !== null || config.embeddings?.provider !== null || config.embeddings?.llmProvider !== null || config.llm?.apiKeyCommand || config.llm?.apiKey || config.llm?.baseUrl) fail('Setup này chỉ dùng structural graph cục bộ, không bật provider/credential command.');
  const extensions = new Set(config.extensions);
  const allowedExtensions = ['.ts', '.tsx', '.js', '.cjs', '.mjs', '.py'];
  if (extensions.size !== allowedExtensions.length || allowedExtensions.some(ext => !extensions.has(ext))) fail('Source extensions không khớp phạm vi đã review.');
  const ignored = new Set(config.ignoreDirs);
  const files = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    if (fs.lstatSync(directory).isSymbolicLink()) fail(`Cần review symlink trước khi index: ${normalized(path.relative(root, directory))}`);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name) || entry.name.startsWith('.env')) continue;
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail(`Cần review symlink trước khi index: ${normalized(path.relative(root, full))}`);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && extensions.has(path.extname(entry.name))) files.push(normalized(path.relative(root, full)));
    }
  }
  for (const dir of sourceRoots) walk(path.join(root, dir));
  const fileSet = new Set(files);
  if (files.length === 0) fail('Không có source trong allowlist.');
  const fingerprint = hash(Buffer.concat(['.codegraphrc.json', 'package.json', 'package-lock.json', '.gitignore'].map(name => fs.readFileSync(path.join(root, name)))));
  const stampPath = path.join(root, '.codegraph/sme-build.json');
  if (build) {
    const result = runCodegraph(['build', root], root);
    if (result.error || result.status !== 0) fail(`CodeGraph build thất bại: ${result.error?.message ?? result.status}`);
  } else {
    if (!fs.existsSync(stampPath)) fail('Thiếu dấu xác nhận build của repo; chạy npm run graph:build.');
    const stamp = readJson(stampPath);
    if (stamp.fingerprint !== fingerprint || stamp.toolVersion !== tool.version) fail('Config/package/lock/ignore đã đổi; chạy npm run graph:build.');
  }
  const dbPath = path.join(root, '.codegraph/graph.db');
  if (!fs.existsSync(dbPath)) fail('Thiếu graph.db; chạy npm run graph:build.');
  const Database = createRequire(packagePath)('better-sqlite3');
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  let counts;
  try {
    const indexed = db.prepare('SELECT file, hash FROM file_hashes').all();
    const indexedSet = new Set(indexed.map(row => normalized(row.file)));
    for (const file of files) if (!indexedSet.has(file)) fail(`Source mới/chưa index: ${file}. Chạy npm run graph:build.`);
    for (const row of indexed) {
      const file = normalized(row.file);
      if (!fileSet.has(file)) fail(`Graph chứa file đã xoá/ngoài allowlist: ${file}. Chạy npm run graph:build.`);
      const algorithm = row.hash.length === 64 ? 'sha256' : row.hash.length === 32 ? 'md5' : null;
      if (!algorithm) fail('Hash schema CodeGraph chưa được adapter hỗ trợ.');
      if (hash(fs.readFileSync(path.join(root, file)), algorithm) !== row.hash) fail(`Graph cũ so với source: ${file}. Chạy npm run graph:build.`);
    }
    counts = {
      files: indexed.length,
      nodes: db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n,
      edges: db.prepare('SELECT COUNT(*) AS n FROM edges').get().n,
      backend: files.filter(file => file.startsWith('backend/')).length,
      frontend: files.filter(file => file.startsWith('frontend/')).length,
      ml: files.filter(file => file.startsWith('ml-service/')).length,
    };
    if (!counts.nodes || !counts.edges || !counts.backend || !counts.frontend || !counts.ml) fail('Graph chưa bao phủ đủ ba module có source.');
  } finally { db.close(); }
  if (build) fs.writeFileSync(stampPath, JSON.stringify({ toolVersion: tool.version, fingerprint, builtAt: new Date().toISOString(), ...counts }, null, 2) + '\n');
  console.log(`CODEGRAPH OK version=${tool.version} files=${counts.files} nodes=${counts.nodes} edges=${counts.edges} backend=${counts.backend} frontend=${counts.frontend} ml=${counts.ml}`);
} catch (error) {
  console.error(`CODEGRAPH BLOCKED: ${error.message}`);
  process.exitCode = 1;
}
