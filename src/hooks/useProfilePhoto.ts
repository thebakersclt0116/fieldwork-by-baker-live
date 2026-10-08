import {useEffect,useState} from 'react';
import {useAuth} from './useAuth';
import {currentManagedToken} from '@/lib/managedSession';
export function useProfilePhoto(){
 const {user}=useAuth();const id=user?.authProvider==='supabase'?user.email:null;
 const [state,setState]=useState<{id:string;url:string|null}|null>(null);
 useEffect(()=>{if(!id)return;let stopped=false,busy=false;
  async function refresh(){if(busy)return;busy=true;try{const token=await currentManagedToken();const response=await fetch('/api/profile-photo',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error();const result=await response.json();if(!stopped)setState({id:id!,url:result.url||null});}catch{if(!stopped)setState({id:id!,url:null});}finally{busy=false;}}
  void refresh();const changed=()=>void refresh();const visible=()=>{if(document.visibilityState==='visible')void refresh();};const timer=window.setInterval(visible,720000);
  window.addEventListener('fieldwork:profile-photo',changed);document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('fieldwork:profile-photo',changed);document.removeEventListener('visibilitychange',visible);};
 },[id]);return state?.id===id?state?.url:null;
}
