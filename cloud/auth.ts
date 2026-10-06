import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { isIP } from 'node:net';
import type { Pool } from 'pg';
import { databasePoolConfig, getPool } from './db.js';
import { isAuthEmailConfigured, sendAuthEmail, type AuthEmailSender } from './email.js';

export { isAuthEmailConfigured } from './email.js';

export const RESERVED_BETA_ACCOUNTS = [
  {
    userId: 'beta-justin-baker',
    email: 'justin@bakerholdings.co',
    name: 'Justin Baker',
    role: 'owner' as const,
    subscription: null,
    exportPass: true,
  },
  {
    userId: 'beta-emily-ayala',
    email: 'ayalaemily52@gmail.com',
    name: 'Emily Ayala',
    role: 'professional' as const,
    subscription: 'professional' as const,
    exportPass: true,
  },
] as const;

/** Shared by the deliberate migration command; these names are not request input. */
export const AUTH_SCHEMA_OPTIONS = {
  user: { modelName: 'fieldwork_auth_user' },
  session: { modelName: 'fieldwork_auth_session' },
  account: { modelName: 'fieldwork_auth_account' },
  verification: { modelName: 'fieldwork_auth_verification' },
  rateLimit: { storage: 'database' as const, modelName: 'fieldwork_auth_rate_limit' },
} satisfies Partial<BetterAuthOptions>;

export function isPublicSignupEnabled(): boolean {
  return process.env.FIELDWORK_SIGNUP_ENABLED === 'true';
}

function validAppOrigin(value: string | undefined, production: boolean): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && !production)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isAuthConfigured(): boolean {
  if ((process.env.BETTER_AUTH_SECRET?.trim().length ?? 0) < 32
      || !validAppOrigin(process.env.FIELDWORK_APP_ORIGIN, process.env.NODE_ENV === 'production')) return false;
  try {
    databasePoolConfig();
    return true;
  } catch {
    return false;
  }
}

/** Account creation time is durable; retries/logins cannot renew a trial. */
export async function ensureDefaultEntitlement(pool: Pool, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO fieldwork_entitlements
       (user_id, role, export_pass, trial_started_at, trial_ends_at)
     SELECT id, 'free', false, "createdAt", "createdAt" + interval '72 hours'
     FROM fieldwork_auth_user WHERE id = $1
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

export interface FieldworkAuthConfig {
  pool: Pool;
  secret: string;
  appOrigin: string;
  signupEnabled: boolean;
  emailConfigured: boolean;
  sendEmail: AuthEmailSender;
  /** Explicitly supplied by local tests; production callers leave this undefined. */
  production?: boolean;
  /** Tests can await captured mail without dispatching anything externally. */
  backgroundTask?: (task: Promise<unknown>) => void;
}

export function createFieldworkAuth(config: FieldworkAuthConfig) {
  const appOrigin = validAppOrigin(config.appOrigin, config.production ?? process.env.NODE_ENV === 'production');
  if (!appOrigin || config.secret.trim().length < 32) {
    throw new Error('Secure account configuration is incomplete.');
  }
  const secureCookies = appOrigin.startsWith('https://');
  const requireEmailDelivery = () => {
    if (!config.emailConfigured) {
      throw new APIError('SERVICE_UNAVAILABLE', { message: 'Account email delivery is not available yet.' });
    }
  };

  return betterAuth({
    ...AUTH_SCHEMA_OPTIONS,
    appName: 'Fieldwork by Baker',
    baseURL: appOrigin,
    basePath: '/api/cloud/auth',
    secret: config.secret,
    database: config.pool,
    trustedOrigins: [appOrigin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        requireEmailDelivery();
        await config.sendEmail({
          to: user.email,
          subject: 'Reset your Fieldwork password',
          text: `A password reset was requested for your Fieldwork account.\n\nChoose a new password using this link (valid for 30 minutes):\n${url}\n\nIf you did not request this, you can ignore this email.`,
          deliveryKey: `reset:${url}`,
        });
      },
      onPasswordReset: async ({ user }) => {
        // A successful single-use token delivered to this inbox also proves
        // inbox control. This is the secure first-password path for beta users.
        await config.pool.query(
          'UPDATE fieldwork_auth_user SET "emailVerified" = true, "updatedAt" = now() WHERE id = $1',
          [user.id],
        );
        await config.pool.query(
          'UPDATE fieldwork_entitlements SET legacy_beta_enabled = false, updated_at = now() WHERE user_id = $1',
          [user.id],
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        requireEmailDelivery();
        await config.sendEmail({
          to: user.email,
          subject: 'Verify your Fieldwork email address',
          text: `Verify your email address to use your Fieldwork account.\n\nOpen this link within one hour:\n${url}\n\nIf you did not create this account, you can ignore this email.`,
          deliveryKey: `verify:${url}`,
        });
      },
    },
    user: {
      ...AUTH_SCHEMA_OPTIONS.user,
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    session: {
      ...AUTH_SCHEMA_OPTIONS.session,
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: {
      ...AUTH_SCHEMA_OPTIONS.account,
      accountLinking: { enabled: false },
    },
    rateLimit: {
      ...AUTH_SCHEMA_OPTIONS.rateLimit,
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60 * 60, max: 5 },
        '/request-password-reset': { window: 60 * 15, max: 5 },
        '/send-verification-email': { window: 60 * 15, max: 5 },
        '/reset-password': { window: 60, max: 10 },
      },
    },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      cookiePrefix: 'fieldwork',
      useSecureCookies: secureCookies,
      defaultCookieAttributes: { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: '/' },
      // The application proxy supplies this only after authenticating the
      // Vercel-to-DigitalOcean hop. Never trust arbitrary forwarded headers.
      ipAddress: { ipAddressHeaders: ['x-fieldwork-client-ip'] },
      backgroundTasks: {
        handler: config.backgroundTask ?? ((task) => {
          void task.catch(() => {
            // No address, password, token, URL, or provider body in logs.
            console.error('Fieldwork account email delivery failed.');
          });
        }),
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.request && !isIP(ctx.request.headers.get('x-fieldwork-client-ip') ?? '')) {
          throw new APIError('SERVICE_UNAVAILABLE', { message: 'Account request verification is unavailable.' });
        }
        if (ctx.path === '/sign-up/email') {
          if (!config.signupEnabled) {
            throw new APIError('SERVICE_UNAVAILABLE', { message: 'New account signup is not available yet.' });
          }
          requireEmailDelivery();
          const email = typeof ctx.body?.email === 'string' ? ctx.body.email.trim().toLowerCase() : '';
          if (RESERVED_BETA_ACCOUNTS.some((account) => account.email === email)) {
            throw new APIError('CONFLICT', { code: 'BETA_ACCOUNT_EXISTS', message: 'This account already exists. Sign in or reset your password.' });
          }
        }
        if (ctx.path === '/request-password-reset' || ctx.path === '/send-verification-email') {
          requireEmailDelivery();
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const email = user.email.trim().toLowerCase();
            const name = user.name.trim();
            if (name.length < 2 || name.length > 240) {
              throw new APIError('BAD_REQUEST', { code: 'INVALID_NAME', message: 'Enter a name between 2 and 240 characters.' });
            }
            if (RESERVED_BETA_ACCOUNTS.some((account) => account.email === email)) {
              throw new APIError('CONFLICT', { code: 'BETA_ACCOUNT_EXISTS', message: 'This account already exists. Sign in or reset your password.' });
            }
            return { data: { ...user, email, name } };
          },
        },
      },
    },
    telemetry: { enabled: false },
  });
}

let auth: ReturnType<typeof createFieldworkAuth> | undefined;

/** Lazy initialization: importing this module never connects or sends mail. */
export function getAuth() {
  if (!auth) {
    if (!isAuthConfigured()) throw new Error('Secure account configuration is incomplete.');
    auth = createFieldworkAuth({
      pool: getPool(),
      secret: process.env.BETTER_AUTH_SECRET!,
      appOrigin: process.env.FIELDWORK_APP_ORIGIN!,
      signupEnabled: isPublicSignupEnabled(),
      emailConfigured: isAuthEmailConfigured(),
      sendEmail: sendAuthEmail,
    });
  }
  return auth;
}
