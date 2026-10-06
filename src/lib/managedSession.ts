export const managedAccountsEnabled = import.meta.env.VITE_MANAGED_ACCOUNTS === 'true';
export const MANAGED_SESSION_KEY = 'bakerManagedSession';
interface ManagedTokens { refreshToken: string; expiresAt: number }
export interface ManagedAccount {
  token: string;
  refreshToken: string;
  expiresAt: number;
  user: { name: string; email: string; role: 'owner'|'free'|'paid'|'professional'|'supervisor'; subscription?: 'none'|'individual'|'professional'; trialEndsAt?: number };
}
export async function accountRequest(body: Record<string,unknown>): Promise<{ response: Response; payload: ManagedAccount & { verificationRequired?: boolean } }> {
  const response = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const payload = await response.json();
  return { response, payload };
}
export function saveManagedTokens(account: ManagedAccount): void {
  localStorage.setItem(MANAGED_SESSION_KEY,JSON.stringify({refreshToken:account.refreshToken,expiresAt:account.expiresAt}));
}
let renewing: Promise<ManagedAccount> | null = null;
// All mounted consumers share one renewal, so a rotating refresh token is used once.
export function renewManagedSession(): Promise<ManagedAccount> {
  if (renewing) return renewing;
  renewing = (async () => {
    const saved = JSON.parse(localStorage.getItem(MANAGED_SESSION_KEY) || 'null') as ManagedTokens|null;
    if (!saved?.refreshToken) throw new Error('Sign in again to renew your session.');
    const { response,payload } = await accountRequest({action:'refresh',refreshToken:saved.refreshToken});
    if (!response.ok || !payload.token || !payload.refreshToken || !payload.user?.email) throw new Error('Sign in again to renew your session.');
    saveManagedTokens(payload);
    return payload;
  })().finally(()=>{renewing=null;});
  return renewing;
}
