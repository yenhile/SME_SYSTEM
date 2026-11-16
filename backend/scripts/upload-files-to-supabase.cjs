// Copies stored documents from the local upload folder into the Supabase Storage bucket.
// Default is a dry run that only counts files; pass --apply to upload.
// Needs a built backend (dist), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and optional SUPABASE_STORAGE_BUCKET / UPLOAD_ROOT.
// Example: node --env-file=.env.cloud scripts/upload-files-to-supabase.cjs --apply
const { readdir, readFile, stat } = require('node:fs/promises');
const { join } = require('node:path');

async function filesIn(dir) {
  const names = await readdir(dir).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const files = [];
  for (const name of names) if ((await stat(join(dir, name))).isFile()) files.push(name);
  return files;
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.');
  process.env.STORAGE_PROVIDER = 'supabase';
  const storage = require('../dist/common/storage');
  const root = storage.uploadRoot();
  const folders = [root, join(root, 'supplements')];
  const summary = { mode: apply ? 'apply' : 'dry-run', uploaded: 0, alreadyThere: 0, mismatched: 0, pending: 0 };
  for (const dir of folders) {
    for (const name of await filesIn(dir)) {
      const bytes = await readFile(join(dir, name));
      const remote = await storage.readStored(dir, name).catch(() => null);
      if (remote) { if (remote.equals(bytes)) summary.alreadyThere++; else summary.mismatched++; continue; }
      if (!apply) { summary.pending++; continue; }
      await storage.writeStored(dir, name, bytes);
      summary.uploaded++;
    }
  }
  console.log(JSON.stringify(summary));
  if (summary.mismatched) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
