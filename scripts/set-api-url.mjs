/**
 * Genera environment.prod.ts desde la variable API_URL (Vercel / CI).
 * Ejemplo en Vercel: API_URL=https://farmacia-hospital-api.onrender.com/api
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

const apiUrl = (process.env.API_URL || '').trim().replace(/\/$/, '');
const fallback = 'https://farmacia-hospital-api.onrender.com/api';

if (!apiUrl && process.env.VERCEL === '1') {
  console.warn(
    '[set-api-url] API_URL no está definida en Vercel. Usando fallback:',
    fallback
  );
}

const url = apiUrl || fallback;

const content = `/** Generado por scripts/set-api-url.mjs — no editar a mano en CI */
export const environment = {
  production: true,
  apiUrl: '${url}'
};
`;

writeFileSync(out, content, 'utf8');
console.log('[set-api-url] apiUrl =', url);
