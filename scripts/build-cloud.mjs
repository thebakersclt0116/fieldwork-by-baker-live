import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Compiling never connects to a database or requires production secrets.
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.cloud.json'], { stdio: 'inherit' });
mkdirSync('dist-cloud/cloud', { recursive: true });
for (const name of readdirSync('cloud').filter((name) => name.endsWith('.sql'))) {
  copyFileSync(resolve('cloud', name), resolve('dist-cloud/cloud', name));
}
