import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getPool, closePool } from './db.js';
import { migrateAuthSchema } from './auth-schema.js';

export async function migrateCloud(): Promise<void> {
  if (process.env.FIELDWORK_MIGRATION_CONFIRM !== 'apply') throw new Error('Set FIELDWORK_MIGRATION_CONFIRM=apply for a deliberate migration.');
  const pool = getPool();
  if ((pool.options.max ?? 5) < 2) throw new Error('Cloud migration requires PG_POOL_MAX of at least 2 for its schema lock and migration connection.');
  const lock = await pool.connect();
  try {
    await lock.query('SELECT pg_advisory_lock(827301946)');
    await migrateAuthSchema(pool);
    const files = (await readdir(new URL('.', import.meta.url))).filter((name) => name.endsWith('.sql'));
    files.sort((a, b) => a === 'schema.sql' ? -1 : b === 'schema.sql' ? 1 : a.localeCompare(b));
    for (const file of files) {
      const sql = await readFile(new URL(file, import.meta.url), 'utf8');
      await pool.query(sql);
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS fieldwork_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO fieldwork_schema_migrations(version) VALUES ('cloud-v1') ON CONFLICT DO NOTHING;`);
    console.info('Fieldwork cloud schema is ready.');
  } finally {
    await lock.query('SELECT pg_advisory_unlock(827301946)').catch(() => {});
    lock.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await migrateCloud(); }
  catch { console.error('Cloud migration did not complete. Review the database configuration and retained data before retrying.'); process.exitCode = 1; }
  finally { await closePool(); }
}
