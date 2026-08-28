import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function projectIdFromUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.supabase.co') ? host.split('.')[0] : null;
  } catch {
    return null;
  }
}

const projectId = process.env.SUPABASE_PROJECT_ID || projectIdFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectId) {
  console.error('No se pudo determinar SUPABASE_PROJECT_ID. Defínelo o configura NEXT_PUBLIC_SUPABASE_URL.');
  process.exit(1);
}

if (!accessToken) {
  console.error('Falta SUPABASE_ACCESS_TOKEN. Créalo en Supabase y expórtalo antes de generar los tipos.');
  process.exit(1);
}

const outputPath = resolve('lib/database.types.ts');
mkdirSync(dirname(outputPath), { recursive: true });

const stdout = execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    '--yes',
    'supabase@latest',
    'gen',
    'types',
    'typescript',
    '--project-id',
    projectId,
    '--schema',
    'public',
  ],
  {
    encoding: 'utf8',
    env: {
      ...process.env,
      SUPABASE_ACCESS_TOKEN: accessToken,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);

writeFileSync(outputPath, stdout, 'utf8');
console.log(`Tipos de Supabase generados en ${outputPath}`);
