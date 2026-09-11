import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outputPath = resolve('api/_runtime-secret.ts');
mkdirSync(dirname(outputPath), { recursive: true });
const secret = randomBytes(48).toString('base64url');
writeFileSync(
  outputPath,
  `// Generated during the Vercel build. Never commit a real secret here.\nexport const BAKER_RUNTIME_SECRET = ${JSON.stringify(secret)};\n`,
  'utf8'
);
console.log('Generated server-only Baker runtime signing secret.');
