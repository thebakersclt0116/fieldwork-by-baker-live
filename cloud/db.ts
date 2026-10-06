import { Pool, type PoolConfig } from 'pg';

let pool: Pool | undefined;

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Keep database credentials on the API server and verify the server certificate. */
export function databasePoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('A PostgreSQL connection is required.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const certificate = env.DATABASE_CA_CERT?.replace(/\\n/g, '\n');
  if (!certificate && (!local || env.NODE_ENV === 'production')) {
    throw new Error('DATABASE_CA_CERT is required for a verified database connection.');
  }
  // node-postgres otherwise lets URI SSL options replace the verified SSL object.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const requestedMax = Number(env.PG_POOL_MAX || 5);
  if (!Number.isInteger(requestedMax) || requestedMax < 1 || requestedMax > 10) {
    throw new Error('PG_POOL_MAX must be between 1 and 10.');
  }
  return {
    connectionString: url.toString(),
    ssl: certificate ? { ca: certificate, rejectUnauthorized: true } : false,
    max: requestedMax,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
    query_timeout: 20000,
    application_name: 'fieldwork-cloud',
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(databasePoolConfig());
    pool.on('error', (error: Error & { code?: string }) => {
      // Connection errors can contain a hostname or other connection details.
      console.error('Database connection error', { code: error.code || 'CONNECTION_ERROR' });
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}

export async function databaseReady(): Promise<boolean> {
  if (!databaseConfigured()) return false;
  try {
    const result = await getPool().query<{ version: string }>(
      "SELECT version FROM fieldwork_schema_migrations WHERE version = 'cloud-v1' LIMIT 1"
    );
    return result.rows.length === 1;
  } catch {
    return false;
  }
}
