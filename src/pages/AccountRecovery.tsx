import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router';

export default function AccountRecovery(){
  const location=useLocation();const reset=location.pathname==='/reset-password';
  const [recoveryToken]=useState(()=>{const params=new URLSearchParams(window.location.hash.slice(1));return params.get('type')==='recovery'?params.get('access_token')||'':'';});
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [error,setError]=useState('');
  const [sessionsRevoked,setSessionsRevoked]=useState(true);
  useEffect(()=>{if(window.location.hash)window.history.replaceState(null,'',window.location.pathname+window.location.search);},[]);
  async function submit(event:React.FormEvent){
    event.preventDefault();setError('');
    if(reset&&(!recoveryToken||password!==confirmation)){setError(!recoveryToken?'Open a fresh password-reset link from your email.':'Your passwords do not match.');return;}
    setBusy(true);
    try{
      const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json',...(reset?{Authorization:`Bearer ${recoveryToken}`}:{})},
        body:JSON.stringify(reset?{action:'reset-password',password}:{action:'recover',email}),signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error('Recovery could not complete. Request a fresh link and try again.');
      const result=await response.json();
      if(reset)setSessionsRevoked(result.sessionsRevoked===true);
      setPassword('');setConfirmation('');setDone(true);
      if(reset){localStorage.removeItem('authUser');localStorage.removeItem('bakerSessionToken');localStorage.removeItem('bakerManagedSession');}
    }catch{setError('Recovery could not complete. Request a fresh link and try again.');}finally{setBusy(false);}
  }
  return <main className="mx-auto max-w-md px-4 py-16"><h1 className="font-serif text-3xl font-semibold">{reset?'Choose a new password':'Recover your account'}</h1>
    {done?<p role="status" className="my-5">{reset?'Your password was changed. Sign in again with your new password.':'If an account exists for that email, you’ll receive a password-reset link. Check your inbox and spam folder.'}</p>:<form onSubmit={submit} className="my-6 space-y-4">
      {reset?<><label className="block">New password<input required minLength={8} maxLength={1024} autoComplete="new-password" type="password" value={password} onChange={event=>setPassword(event.target.value)} className="mt-2 w-full rounded border p-3"/></label><label className="block">Confirm password<input required minLength={8} maxLength={1024} autoComplete="new-password" type="password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="mt-2 w-full rounded border p-3"/></label></>:<label className="block">Account email<input required maxLength={254} autoComplete="email" type="email" value={email} onChange={event=>setEmail(event.target.value)} className="mt-2 w-full rounded border p-3"/></label>}
      {error&&<p role="alert">{error}</p>}<button disabled={busy||(reset&&!recoveryToken)} className="rounded bg-[#E85D70] px-5 py-3 font-semibold text-white">{busy?'Please wait…':reset?'Save new password':'Send recovery email'}</button>
    </form>}<Link to="/login" className="inline-block font-semibold text-[#D94D62]">Return to sign in</Link>
    {done&&reset&&!sessionsRevoked&&<p role="alert" className="mt-4">Your password changed, but signing out other sessions could not be confirmed. Contact support to finish securing your account.</p>}
  </main>;
}
