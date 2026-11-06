import { resolve } from 'node:path';
/** Deployment configuration only; never supplied by a request. Tests own a separate directory. */
export const uploadRoot = () => resolve(process.env.UPLOAD_ROOT || resolve(process.cwd(),'uploads'));
