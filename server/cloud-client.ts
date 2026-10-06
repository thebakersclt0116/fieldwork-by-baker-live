/** Server-only Supabase REST boundary. User calls keep their JWT so database RLS remains authoritative. */
export class CloudError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
export function cloudConfiguration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new CloudError('CLOUD_NOT_CONFIGURED');
  if (!key.startsWith('sb_publishable_')) throw new CloudError('INVALID_CLOUD_CONFIGURATION');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.username || parsed.password || parsed.pathname !== '/') throw new CloudError('INVALID_CLOUD_CONFIGURATION');
  return { url: parsed.origin, key };
}
export async function cloudRequest(path: string, token: string | null, options: RequestInit = {}) {
  const { url, key } = cloudConfiguration();
  if (!path.startsWith('/rest/v1/') && !path.startsWith('/auth/v1/') && !path.startsWith('/storage/v1/')) throw new CloudError('INVALID_CLOUD_PATH',400);
  let response: Response;
  try {
    response = await fetch(url + path, { ...options, signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  } catch { throw new CloudError('CLOUD_UNAVAILABLE'); }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'message' in payload ? String(payload.message) : '';
    if (detail.includes('FORM_EMAIL_LIMIT')) throw new CloudError('FORM_EMAIL_LIMIT',429);
    if (detail.includes('EMAIL_REQUEST_CONFLICT') || detail.includes('EMAIL_REQUEST_EXPIRED')) throw new CloudError('EMAIL_REQUEST_CONFLICT',409);
    if (detail.includes('PAID_SUBSCRIPTION_REQUIRED')) throw new CloudError('PAID_SUBSCRIPTION_REQUIRED',403);
    if (detail.includes('VERSION_CONFLICT')) throw new CloudError('VERSION_CONFLICT',409);
    if (detail.includes('REVIEW_ALREADY_SAVED')) throw new CloudError('REVIEW_ALREADY_SAVED',409);
    if (detail.includes('REVIEW_NOT_AVAILABLE')) throw new CloudError('REVIEW_NOT_AVAILABLE',403);
    if (detail.includes('SUPERVISOR_TOOLS_REQUIRED')) throw new CloudError('SUPERVISOR_TOOLS_REQUIRED',403);
    if (detail.includes('INVITATION_LIMIT')) throw new CloudError('INVITATION_LIMIT',429);
    if (detail.includes('APPROVED_EDIT_REASON_REQUIRED')) throw new CloudError('APPROVED_EDIT_REASON_REQUIRED',400);
    if (detail.includes('STORAGE_LIMIT')) throw new CloudError('STORAGE_LIMIT',413);
    if (detail.includes('ORIGINAL_NOT_VERIFIED')) throw new CloudError('ORIGINAL_NOT_VERIFIED',409);
    if (detail.includes('IMPORT_NOT_PREPARED') || detail.includes('INVALID_IMPORT') || detail.includes('INVALID_DOCUMENT') || detail.includes('INVALID_HASH')) throw new CloudError('INVALID_ARCHIVE_RECORD',400);
    throw new CloudError(response.status===401||response.status===403?'AUTH_REQUIRED':'CLOUD_REQUEST_FAILED',response.status===401||response.status===403?401:502);
  }
  return payload;
}
export type VerifiedCloudUser = { id: string; email: string; email_confirmed_at: string; user_metadata?: { name?: string } };
export async function verifyCloudUser(token: string): Promise<VerifiedCloudUser> {
  const result = await cloudRequest('/auth/v1/user',token);
  if (!result || typeof result !== 'object' || !('id' in result) || !('email' in result) || !('email_confirmed_at' in result) || !result.email_confirmed_at) throw new CloudError('EMAIL_VERIFICATION_REQUIRED',401);
  const user = result as VerifiedCloudUser;
  if (typeof user.id!=='string' || !/^[a-f0-9-]{36}$/.test(user.id) || typeof user.email!=='string') throw new CloudError('AUTH_REQUIRED',401);
  return user;
}
