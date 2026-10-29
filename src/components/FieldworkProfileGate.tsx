import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useFieldworkProfile } from '@/hooks/useFieldworkProfile';
import { getCurrentUserEmail } from '@/lib/fieldworkStore';
import { readTimerJournal } from '@/lib/fieldworkTimer';
/** Runs inside ProtectedRoute, after the cloud workspace is hydrated. It never blocks private audit reads or billing. */
export default function FieldworkProfileGate({ children }: { children: ReactNode }) {
  const profile = useFieldworkProfile(), location = useLocation();
  if (profile) return <>{children}</>;
  // Preserve a timer started before this upgrade: users must still be able to stop it and recover their drafts.
  let running = false;
  try { const email = getCurrentUserEmail(); running = Boolean(email && readTimerJournal(email).running); } catch { /* The timer UI retains its own recovery error. */ }
  if (location.pathname === '/dashboard' && running) return <><div role="status" className="mx-auto max-w-6xl rounded-xl border border-amber-400 p-4 text-sm">Your existing timer is still running. Stop it safely, then <Link to="/fieldwork-profile" className="font-semibold underline">complete your fieldwork profile</Link> before starting another session.</div>{children}</>;
  return <Navigate to={'/fieldwork-profile?return=' + encodeURIComponent(location.pathname + location.search)} replace />;
}
