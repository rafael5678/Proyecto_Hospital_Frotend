/**
 * Writes environment.prod.ts from API_URL (Vercel / CI).
 * Example: API_URL=https://proyecto-hospital-backend.onrender.com/api
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

const apiUrl = (process.env.API_URL || '').trim().replace(/\/$/, '');
const fallback = 'https://proyecto-hospital-backend.onrender.com/api';

if (!apiUrl && process.env.VERCEL === '1') {
  console.warn(
    '[set-api-url] API_URL is not set on Vercel. Using fallback:',
    fallback
  );
}

const url = apiUrl || fallback;

const content = `/** Written by scripts/set-api-url.mjs. Do not edit by hand in CI. */
export const environment = {
  production: true,
  apiUrl: '${url}'
};
`;

writeFileSync(out, content, 'utf8');
console.log('[set-api-url] apiUrl =', url);
