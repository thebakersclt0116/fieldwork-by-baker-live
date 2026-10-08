import { useState } from 'react';
import { getStoredAccessToken, useAuth } from '@/hooks/useAuth';
export default function AdMeasurementTest() {
  const { isOwner } = useAuth();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isOwner) return <p className="p-8">Owner access required.</p>;
  const run = async () => {
    setBusy(true); setStatus('Sending a fictional purchase to Meta Test Events…');
    try {
      const response = await fetch('/api/ad-measurement-test', { method: 'POST', headers: { Authorization: `Bearer ${getStoredAccessToken()}`, 'Content-Type': 'application/json' }, body: '{}' });
      const result = await response.json();
      if (!response.ok || !result.received) throw new Error(result.code || 'Test failed');
      setStatus('Meta received the fictional purchase in Test Events only. $0 payments, renewals and returning members were excluded. No charge was made. Event: ' + result.eventId);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Test failed'); } finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-2xl p-8"><h1 className="font-serif text-3xl">Ad measurement launch test</h1><p className="my-4">Preview only. Uses fictional identifiers and Meta’s separate Test Events stream.</p><button disabled={busy} onClick={() => void run()} className="rounded-xl bg-[#E85D70] px-5 py-3 font-semibold text-white disabled:opacity-50">Send fictional purchase test</button><p role="status" className="mt-5 break-words">{status}</p></section>;
}
