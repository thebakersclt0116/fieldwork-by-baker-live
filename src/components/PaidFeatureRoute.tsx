import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

export default function PaidFeatureRoute({ children }: { children: ReactNode }) {
  const { isLoading, hasPaidFeatures } = useAuth();

  if (isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center bg-[#FFFCF9] text-sm text-[#A8998E]">Checking your plan…</div>;
  }

  if (!hasPaidFeatures) return <Navigate to="/upgrade" replace />;
  return <>{children}</>;
}
