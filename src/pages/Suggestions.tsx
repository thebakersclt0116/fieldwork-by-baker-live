import { useRef, useState } from 'react';
import { Lightbulb, Send, CheckCircle2 } from 'lucide-react';
import { currentManagedToken } from '@/lib/managedSession';

export default function Suggestions() {
  const [category, setCategory] = useState('Site improvement');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const token = await currentManagedToken();
      if (!token) throw new Error('Please sign in with your verified account to send a suggestion.');
      const response = await fetch('/api/suggestions', {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify({category, message, page, requestId:requestId.current})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.code === 'SUGGESTION_LIMIT' ? 'You’ve sent 5 suggestions today. Please try again tomorrow.' : 'Your suggestion could not be sent. Please try again.');
      setSent(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl px-4 py-12"><span className="inline-flex items-center gap-2 rounded-full bg-[#fff0f3] px-3 py-2 text-sm font-semibold text-[#d94d62]"><Lightbulb size={16} /> Built with you</span><h1 className="mt-5 font-serif text-4xl text-[#332c28] dark:text-white">Make Fieldwork even better.</h1><p className="mt-4 text-[#6b5d54] dark:text-[#cfc4be]">An idea, a small frustration, or something that feels slow—we’re listening. Help us improve the workspace you use every day.</p>
    {sent ? <div role="status" className="mt-8 rounded-3xl border border-[#cde5d8] bg-[#f0faf4] p-8 text-[#326649]"><CheckCircle2 size={28} /><h2 className="mt-3 text-xl font-semibold">Your suggestion is on its way.</h2><p className="mt-2">Thank you for helping shape Fieldwork. Your submission has been accepted for delivery to both team inboxes.</p><button onClick={()=>{setSent(false);setMessage('');setPage('');requestId.current=crypto.randomUUID();}} className="mt-5 font-semibold underline">Share another idea</button></div> : <form onSubmit={submit} className="mt-8 space-y-5 rounded-3xl border border-[#eaded4] bg-white p-6 shadow-sm dark:bg-[#211d1a] dark:text-white">
    <label className="block text-sm font-semibold">What would you like to improve?<select value={category} onChange={e=>{setCategory(e.target.value);requestId.current=crypto.randomUUID();}} className="mt-2 w-full rounded-xl border border-[#e2dad5] bg-transparent p-3"><option>Site improvement</option><option>Performance or speed</option><option>Feature request</option><option>Something isn’t working</option><option>Mobile app idea</option></select></label>
    <label className="block text-sm font-semibold">Your suggestion<textarea required minLength={10} maxLength={4000} value={message} onChange={e=>{setMessage(e.target.value);requestId.current=crypto.randomUUID();}} rows={6} className="mt-2 w-full rounded-xl border border-[#e2dad5] bg-transparent p-3 font-normal" placeholder="What happened, or what would make your experience better?" /></label>
    <label className="block text-sm font-semibold">Which page? <span className="font-normal text-[#9b8575]">Optional</span><input maxLength={200} value={page} onChange={e=>{setPage(e.target.value);requestId.current=crypto.randomUUID();}} className="mt-2 w-full rounded-xl border border-[#e2dad5] bg-transparent p-3 font-normal" placeholder="For example: Dashboard or Import" /></label>
    <p className="text-xs leading-relaxed text-[#9b8575]">Your suggestion and account email go to thebakersclt@gmail.com and Justin@bakerholdings.co so our team can follow up. Please leave out client information, passwords, and payment details.</p>
    {error && <p role="alert" className="text-sm text-[#c63e54]">{error}</p>}<button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#e85d70] px-5 py-3 font-semibold text-white disabled:opacity-50"><Send size={16} />{busy ? 'Sending…' : 'Send suggestion'}</button>
    </form>}
  </main>;
}
