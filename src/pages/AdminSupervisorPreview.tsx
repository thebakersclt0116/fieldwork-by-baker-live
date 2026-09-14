import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';

const EMILY_EMAIL = 'ayalaemily52@gmail.com';

export default function AdminSupervisorPreview() {
  const { isOwner } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOwner) return;
    let active = true;

    const openPreview = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        if (active) setError('Your owner session is missing. Sign in again and reopen this preview.');
        return;
      }

      try {
        const today = new Date().toISOString().slice(0, 10);
        const response = await fetch('/api/supervisor-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            supervisorName: 'Supervisor Preview',
            supervisorEmail: 'supervisor-preview@fieldworkbybaker.com',
            superviseeEmail: EMILY_EMAIL,
            reviewEntry: {
              id: `admin_preview_${today}`,
              date: today,
              duration: 1,
              activityCategory: 'UNRESTRICTED',
              supervisorName: 'Carrie — preview',
              supervisionMinutes: 25,
              narrative: [
                'Organization: Melmark Carolinas • Time: 08:30–09:30 • Entry type: Supervised • Supervision format: Individual • Client observation: 25 min (In Person) • Client: Leo',
                '',
                'Reviewed behavior plans and behavior-analytic data while the assigned supervisor observed the trainee working with the client. This is demonstration data for the owner preview only.',
              ].join('\n'),
            },
          }),
        });

        const payload = await response.json() as { path?: string; error?: string };
        if (!response.ok || !payload.path) {
          throw new Error(payload.error || 'Could not create the supervisor preview.');
        }

        window.location.replace(payload.path);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not create the supervisor preview.');
      }
    };

    void openPreview();
    return () => { active = false; };
  }, [isOwner]);

  if (!isOwner) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-[#FFFCF9] px-4">
      <div className="max-w-lg w-full rounded-3xl border border-[#F2EDEA] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5EE] text-[#5FA37E]">
          <ShieldCheck size={24} />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-[#332C28]">Opening supervisor preview</h1>
        <p className="mt-2 text-sm text-[#A8998E]">
          Baker is generating a temporary signed invite so you see the exact supervisor experience.
        </p>
        {error && <div className="mt-5 rounded-xl bg-[#FFF5F7] px-4 py-3 text-sm text-[#C9445A]">{error}</div>}
      </div>
    </div>
  );
}
