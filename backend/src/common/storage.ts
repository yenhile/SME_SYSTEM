import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
/** Deployment configuration only; never supplied by a request. Tests own a separate directory. */
export const uploadRoot = () => resolve(process.env.UPLOAD_ROOT || resolve(process.cwd(),'uploads'));

const STORAGE_TIMEOUT_MS = 30_000;
const useSupabase = () => process.env.STORAGE_PROVIDER === 'supabase';

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'sme-documents';
  if (!url || !key) throw new Error('Supabase Storage chưa được cấu hình.');
  return { url, key, bucket };
}

/** Object path inside the bucket mirrors the file's location under the upload root. */
function objectPath(dir: string, key: string) {
  const path = relative(uploadRoot(), resolve(dir, key));
  if (!path || path.startsWith('..') || isAbsolute(path)) throw new Error('Đường dẫn tệp nằm ngoài thư mục lưu trữ.');
  return path.split(sep).map(encodeURIComponent).join('/');
}

async function supabaseRequest(method: string, route: string, dir: string, key: string, body?: Buffer) {
  const { url, key: serviceKey, bucket } = supabaseConfig();
  const response = await fetch(`${url}/storage/v1/object/${route}${bucket}/${objectPath(dir, key)}`, {
    method,
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' },
    body: body ? new Uint8Array(body) : undefined,
    signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Supabase Storage trả mã ${response.status}.`);
  return response;
}

/** Stores a new file; fails when the key already exists so an upload never overwrites another. */
export async function writeStored(dir: string, key: string, buffer: Buffer) {
  if (useSupabase()) { await supabaseRequest('POST', '', dir, key, buffer); return; }
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, key), buffer, { flag: 'wx' });
}

export async function readStored(dir: string, key: string): Promise<Buffer> {
  if (useSupabase()) return Buffer.from(await (await supabaseRequest('GET', 'authenticated/', dir, key)).arrayBuffer());
  return readFile(join(dir, key));
}

export async function removeStored(dir: string, key: string) {
  if (useSupabase()) { await supabaseRequest('DELETE', '', dir, key); return; }
  await unlink(join(dir, key));
}
