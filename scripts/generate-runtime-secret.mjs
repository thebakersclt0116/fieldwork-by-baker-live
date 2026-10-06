// Kept as a build compatibility entry point. Never write credentials into source.
const secret = process.env.BAKER_SESSION_SECRET;
if (secret && secret.length < 32) throw new Error('BAKER_SESSION_SECRET must have at least 32 characters.');
if (!secret) console.warn('BAKER_SESSION_SECRET is absent. Public signup and signed invitations will fail closed; configure a stable server secret before rollout.');
