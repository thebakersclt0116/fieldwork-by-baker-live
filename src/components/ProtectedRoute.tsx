import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, hasAppAccess, sessionError, refreshSession } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#FFFCF9]">
        <div className="text-sm text-[#A8998E]">Verifying secure access…</div>
      </div>
    );
  }

  if (!hasAppAccess && sessionError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#FFFCF9] px-4">
        <div className="max-w-md rounded-2xl border border-[#F2EDEA] bg-white p-7 text-center" role="alert">
          <h1 className="font-serif text-2xl text-[#332C28] mb-3">Unable to verify access</h1>
          <p className="text-sm text-[#7B6B62] mb-5">{sessionError}</p>
          <button type="button" className="btn-primary px-5 py-2.5 rounded-xl" onClick={() => { void refreshSession(); }}>Try again</button>
          <Link to={`/login?return=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} className="block mt-4 text-sm text-[#E85D70]">Return to sign in</Link>
        </div>
      </div>
    );
  }

  if (!hasAppAccess) return <Navigate to={`/login?return=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`} replace />;
  return <>{children}</>;
}
