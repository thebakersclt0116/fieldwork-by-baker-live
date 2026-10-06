import { getMigrations } from 'better-auth/db/migration';
import type { Pool } from 'pg';
import { AUTH_SCHEMA_OPTIONS, RESERVED_BETA_ACCOUNTS } from './auth.js';

/**
 * Called only by the explicit migration command or an isolated test database.
 * Never call this from a request, application build, or server startup.
 */
export async function migrateAuthSchema(pool: Pool): Promise<void> {
  const migration = await getMigrations({
    ...AUTH_SCHEMA_OPTIONS,
    database: pool,
    emailAndPassword: { enabled: true },
    rateLimit: { ...AUTH_SCHEMA_OPTIONS.rateLimit, enabled: true },
  });
  await migration.runMigrations();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS fieldwork_auth_user_email_normalized
        ON fieldwork_auth_user (lower(email));

      CREATE TABLE IF NOT EXISTS fieldwork_entitlements (
        user_id text PRIMARY KEY REFERENCES fieldwork_auth_user(id) ON DELETE RESTRICT,
        role text NOT NULL DEFAULT 'free'
          CHECK (role IN ('owner', 'free', 'paid', 'professional', 'supervisor')),
        subscription text CHECK (subscription IN ('individual', 'professional', 'enterprise')),
        export_pass boolean NOT NULL DEFAULT false,
        billing_access_ends_at timestamptz,
        legacy_beta_enabled boolean NOT NULL DEFAULT false,
        trial_started_at timestamptz,
        trial_ends_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (
          (trial_started_at IS NULL AND trial_ends_at IS NULL)
          OR (trial_started_at IS NOT NULL AND trial_ends_at = trial_started_at + interval '72 hours')
        )
      );

      ALTER TABLE fieldwork_entitlements ADD COLUMN IF NOT EXISTS billing_access_ends_at timestamptz;
      ALTER TABLE fieldwork_entitlements ADD COLUMN IF NOT EXISTS legacy_beta_enabled boolean NOT NULL DEFAULT false;

      CREATE OR REPLACE FUNCTION fieldwork_keep_trial_dates()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at
           OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
          RAISE EXCEPTION 'Fieldwork trial dates are immutable';
        END IF;
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS fieldwork_entitlements_trial_dates ON fieldwork_entitlements;
      CREATE TRIGGER fieldwork_entitlements_trial_dates
        BEFORE UPDATE ON fieldwork_entitlements
        FOR EACH ROW EXECUTE FUNCTION fieldwork_keep_trial_dates();
    `);

    for (const account of RESERVED_BETA_ACCOUNTS) {
      // No password or credential is generated or stored. Existing signed beta
      // login remains valid; inbox password recovery establishes a durable one.
      await client.query(
        `INSERT INTO fieldwork_auth_user (id, name, email, "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [account.userId, account.name, account.email],
      );
      const existing = await client.query<{ email: string }>(
        'SELECT email FROM fieldwork_auth_user WHERE id = $1',
        [account.userId],
      );
      if (existing.rows[0]?.email.toLowerCase() !== account.email) {
        throw new Error('Reserved Fieldwork account identity does not match.');
      }
      await client.query(
        `INSERT INTO fieldwork_entitlements (user_id, role, subscription, export_pass, legacy_beta_enabled)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (user_id) DO UPDATE
         SET role = EXCLUDED.role, subscription = EXCLUDED.subscription,
             export_pass = EXCLUDED.export_pass, updated_at = now()`,
        [account.userId, account.role, account.subscription, account.exportPass],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
