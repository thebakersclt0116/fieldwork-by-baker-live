import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { cloudState, subscribeCloud, initializeCloud, exportCloudDraft } from '@/lib/cloudWorkspace';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, hasAppAccess, user } = useAuth();
  const status=useSyncExternalStore(subscribeCloud,cloudState);
  const [loadedEmail,setLoadedEmail]=useState('');
  useEffect(()=>{
    if(!isLoading&&user?.authProvider==='supabase'){
      let mounted=true;
      void initializeCloud(user.email.trim().toLowerCase()).then(()=>{if(mounted)setLoadedEmail(user.email);}).catch(()=>{});
      return ()=>{mounted=false;};
    }
  },[isLoading,user?.email,user?.authProvider]);
  useEffect(()=>{
    const guard=(event:BeforeUnloadEvent)=>{if(user?.authProvider==='supabase'&&(status==='saving'||status==='blocked')){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',guard);return ()=>window.removeEventListener('beforeunload',guard);
  },[status,user?.authProvider]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#FFFCF9]">
        <div className="text-sm text-[#A8998E]">Verifying secure access…</div>
      </div>
    );
  }

  if (!hasAppAccess) return <Navigate to="/login" replace />;
  if(user?.authProvider==='supabase'){
    if(status==='blocked')return <div role="alert" className="p-6"><h1 className="text-xl font-semibold">Your changes need review</h1><p className="my-3">Cloud saving did not finish, or another device changed these records. Your local draft has been retained. Export it before resolving the conflict.</p><button onClick={exportCloudDraft} className="rounded border p-3">Download local backup</button></div>;
    if(loadedEmail!==user.email)return <div role="status" className="p-6">Loading your saved records…</div>;
    return <><div role="status" aria-live="polite" className="px-6 py-2 text-sm">{status==='saving'?'Saving your changes…':'Saved to your account'}</div>{children}</>;
  }
  return <>{children}</>;
}
