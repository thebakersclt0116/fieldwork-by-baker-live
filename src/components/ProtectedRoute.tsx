import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, hasAppAccess } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#FFFCF9]">
        <div className="text-sm text-[#A8998E]">Verifying secure access…</div>
      </div>
    );
  }

  if (!hasAppAccess) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
