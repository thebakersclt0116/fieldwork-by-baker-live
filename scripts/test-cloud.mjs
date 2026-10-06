#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const root = fileURLToPath(new URL('../', import.meta.url));

async function testFiles() {
  const groups = [
    ['cloud/tests', (name) => name.endsWith('.test.ts')],
    ['cloud', (name) => name.endsWith('.test.ts')],
    ['scripts', (name) => name.startsWith('cloud-') && name.endsWith('.test.ts')],
  ];
  const files = (await Promise.all(groups.map(async ([directory, matches]) => {
    const entries = await readdir(new URL(`../${directory}/`, import.meta.url), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && matches(entry.name))
      .map((entry) => `${directory}/${entry.name}`).sort();
  }))).flat();
  files.push('scripts/frontend-auth.test.ts');
  const requested = process.argv.slice(2);
  if (!requested.length) return files;
  for (const file of requested) {
    if (!files.includes(file)) throw new Error(`Unknown cloud test file: ${file}`);
  }
  return [...new Set(requested)];
}

function isolatedEnvironment(databaseUrl) {
  const env = { ...process.env };
  // Tests supply their own credentials and endpoints. Never inherit application
  // secrets or let a missing test fixture fall back to a production database.
  for (const key of Object.keys(env)) {
    if (/^(?:FIELDWORK_|BETTER_AUTH_|BAKER_|STRIPE_|RESEND_|DATABASE_|PGHOST$|PGPORT$|PGUSER$|PGPASSWORD$|PGDATABASE$|PGSERVICE$|PGSERVICEFILE$)/.test(key)) {
      delete env[key];
    }
  }
  // Better Auth disables origin checking by default in NODE_ENV=test. Keep
  // normal checks enabled here; individual fixtures set explicit runtime modes.
  env.NODE_ENV = 'development';
  env.FIELDWORK_TEST_DATABASE_URL = databaseUrl;
  return env;
}

async function main() {
  const files = await testFiles();
  let db;
  let server;
  let child;
  let interrupted;
  let forceStop;
  const stop = (signal) => {
    interrupted = signal;
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
      forceStop ??= setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
    }
  };
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  try {
    // Keep the socket server and child in the same process/network namespace.
    // The database is in memory and the OS chooses an unused loopback port.
    db = await PGlite.create();
    server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 8 });
    await server.start();
    if (interrupted) return interrupted === 'SIGINT' ? 130 : 143;
    const connection = server.getServerConn();
    if (!/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(connection)) {
      throw new Error('The test database must listen only on an ephemeral loopback port.');
    }
    const databaseUrl = `postgresql://postgres:postgres@${connection}/postgres`;
    console.log(`Running ${files.length} cloud test files against a new in-memory PostgreSQL database (PGlite).`);
    child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...files], {
      cwd: root,
      env: isolatedEnvironment(databaseUrl),
      stdio: 'inherit',
    });
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
    return interrupted ? (interrupted === 'SIGINT' ? 130 : 143) : exitCode;
  } finally {
    clearTimeout(forceStop);
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
    try { await server?.stop(); }
    finally { await db?.close(); }
  }
}

try { process.exitCode = await main(); }
catch (error) {
  console.error(`Cloud tests could not complete: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
}
