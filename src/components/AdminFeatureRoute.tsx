import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

type AccessState = 'checking' | 'allowed' | 'denied' | 'unavailable';

/** Archived products and administrator tools require a verified server role. */
export default function AdminFeatureRoute({ children }: { children: ReactNode }) {
  const { accessToken, hasAppAccess, isLoading, isOwner } = useAuth();
  const [verification, setVerification] = useState<{ token: string | null; state: AccessState }>({ token: null, state: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isLoading || !hasAppAccess || !isOwner || !accessToken) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let active = true;
    void fetch('/api/admin-access', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      if (response.status === 401 || response.status === 403) return 'denied' as const;
      if (!response.ok) return 'unavailable' as const;
      const payload = await response.json() as { authorized?: boolean };
      return payload.authorized === true ? 'allowed' as const : 'denied' as const;
    }).catch(() => 'unavailable' as const).then((state) => {
      if (active) setVerification({ token: accessToken, state });
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [accessToken, attempt, hasAppAccess, isLoading, isOwner]);

  if (isLoading) return <div role="status" className="p-8 text-sm">Checking administrator access…</div>;
  if (!hasAppAccess) return <Navigate to="/login" replace />;
  if (!isOwner) return <Navigate to="/dashboard" replace />;

  const state = verification.token === accessToken ? verification.state : 'checking';
  if (state === 'checking') return <div role="status" className="p-8 text-sm">Checking administrator access…</div>;
  if (state === 'denied') return <Navigate to="/dashboard" replace />;
  if (state === 'unavailable') {
    return <div className="mx-auto max-w-xl space-y-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Administrator access could not be verified</h1>
      <p role="alert">The product archive stays closed until your administrator session can be verified. Try again, or sign in again if your session has expired.</p>
      <div className="flex flex-wrap gap-4">
        <button type="button" className="rounded-xl bg-[#332C28] px-4 py-3 font-semibold text-white" onClick={() => { setVerification({ token: null, state: 'checking' }); setAttempt((value) => value + 1); }}>Try again</button>
        <Link className="rounded-xl border border-[#E2DAD5] px-4 py-3" to="/dashboard">Back to My Hours</Link>
      </div>
    </div>;
  }
  return <>{children}</>;
}
