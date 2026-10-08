import ProfilePhotoSettings from '@/components/ProfilePhotoSettings';
import CommunitySettings from '@/components/CommunitySettings';
import {Link} from 'react-router';
import {useAuth} from '@/hooks/useAuth';
import {currentManagedToken} from '@/lib/managedSession';
import { useState } from 'react';
import { getTimeFormat, setTimeFormat, type TimeFormat } from '@/lib/timeDisplay';

export default function AccountSettings() {
  const {user}=useAuth();
  const [billingMessage,setBillingMessage]=useState('');
  const [billingBusy,setBillingBusy]=useState(false);
  const openBilling=async()=>{setBillingBusy(true);setBillingMessage('');try{const token=await currentManagedToken();const response=await fetch('/api/billing-portal',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(25000)});const result=await response.json();if(!response.ok||!result.url)throw new Error(result.error||'Your billing page could not open.');window.location.assign(result.url);}catch(error){setBillingMessage(error instanceof Error?error.message:'Your billing page could not open.');}finally{setBillingBusy(false);}};
  const [format, setFormat] = useState<TimeFormat>(getTimeFormat);
  const [message, setMessage] = useState('');
  return <div className="min-h-screen bg-[#FFFCF9] px-4 py-8 text-[#332C28] dark:bg-[#171412] dark:text-white"><div className="mx-auto max-w-2xl">
    <h1 className="font-serif text-4xl">Account settings</h1>
    <section className="mt-6 rounded-2xl border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]">
      <fieldset><legend className="text-lg font-semibold">Time format</legend><p className="mt-2 text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Choose how times appear when reviewing and logging fieldwork.</p>
        <label className="mt-5 flex items-center gap-3"><input type="radio" name="time-format" value="12" checked={format === '12'} onChange={() => setFormat('12')}/>12-hour · 2:30 PM (default)</label>
        <label className="mt-3 flex items-center gap-3"><input type="radio" name="time-format" value="24" checked={format === '24'} onChange={() => setFormat('24')}/>24-hour · 14:30</label>
      </fieldset>
      <button className="mt-6 rounded-xl bg-[#E85D70] px-5 py-3 font-semibold text-white" onClick={() => { try { setTimeFormat(format); setMessage('Time format saved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your preference.'); } }}>Save settings</button>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      <p className="mt-4 text-xs text-[#6B5D54] dark:text-[#CFC4BE]">This preference is saved for your account in this browser. Original source records and exported source data retain their exact values.</p>
    </section>
    {user?.authProvider==='supabase'&&<><ProfilePhotoSettings/><CommunitySettings/></>}
    {user?.authProvider==='supabase'&&<section className="mt-6 rounded-2xl border border-[#F2EDEA] bg-white p-6 dark:border-white/10 dark:bg-[#211D1A]"><h2 className="text-lg font-semibold">Subscription & billing</h2><p className="mt-2 text-sm text-[#6B5D54] dark:text-[#CFC4BE]">Manage your plan, payment method, invoices, and cancellation through Stripe.</p><div className="mt-4 flex flex-wrap gap-3"><button disabled={billingBusy} onClick={openBilling} className="rounded-xl bg-[#332C28] px-5 py-3 font-semibold text-white disabled:opacity-40">{billingBusy?'Opening billing…':'Manage subscription'}</button><Link to="/upgrade" className="rounded-xl border px-5 py-3 font-semibold">View plans</Link></div>{billingMessage&&<p role="status" className="mt-3 text-sm">{billingMessage}</p>}</section>}
  </div></div>;
}

