import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
      console.log(`Variables cargadas desde ${file}`);
      return;
    } catch (error) {
      console.warn(`No se pudo cargar ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function projectIdFromUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.supabase.co') ? host.split('.')[0] : null;
  } catch {
    return null;
  }
}

loadLocalEnv();

const useLocal = process.argv.includes('--local');
const projectId = process.env.SUPABASE_PROJECT_ID || projectIdFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!useLocal && !projectId) {
  console.error('No se pudo determinar SUPABASE_PROJECT_ID. Defínelo o configura NEXT_PUBLIC_SUPABASE_URL en .env.local.');
  process.exit(1);
}

if (!useLocal && !accessToken) {
  console.error('Falta SUPABASE_ACCESS_TOKEN. Agrégalo a .env.local o expórtalo antes de generar los tipos.');
  process.exit(1);
}

const outputPath = resolve('lib/database.types.ts');
mkdirSync(dirname(outputPath), { recursive: true });

const cliArgs = [
  '--yes',
  'supabase@latest',
  'gen',
  'types',
  'typescript',
  ...(useLocal ? ['--local'] : ['--project-id', projectId]),
  '--schema',
  'public',
];

const stdout = execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  cliArgs,
  {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(accessToken ? { SUPABASE_ACCESS_TOKEN: accessToken } : {}),
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);

if (!stdout.includes('export type Database')) {
  console.error('La salida de Supabase CLI no contiene un tipo Database válido.');
  process.exit(1);
}

writeFileSync(outputPath, stdout, 'utf8');
console.log(`Tipos de Supabase generados en ${outputPath} (${useLocal ? 'local' : `proyecto ${projectId}`}).`);
