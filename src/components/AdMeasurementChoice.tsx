import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { captureAdClick, readAdChoice, saveAdChoice } from '@/lib/adMeasurement';
const PUBLIC_PATHS = new Set(['/', '/demo', '/pricing', '/features', '/about', '/faq', '/contact', '/privacy', '/cookies', '/terms', '/security', '/signup', '/upgrade']);
export default function AdMeasurementChoice() {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(() => !readAdChoice());
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { let active = true; fetch('/api/ad-measurement-config', { cache: 'no-store' }).then(r => r.json()).then(data => { if (active) setEnabled(data.enabled === true); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { if (PUBLIC_PATHS.has(pathname)) captureAdClick(); }, [pathname, search]);
  if (!enabled || !PUBLIC_PATHS.has(pathname)) return null;
  if (!open) return <button onClick={() => setOpen(true)} className="fixed bottom-3 left-3 z-40 rounded-full border border-[#E2DAD5] bg-white px-3 py-2 text-xs text-[#6B5D54] shadow-sm dark:border-white/15 dark:bg-[#211D1A] dark:text-[#EADFD7]">Ad privacy</button>;
  const choose = (allowed: boolean) => { saveAdChoice(allowed); setOpen(false); };
  return <aside aria-label="Optional ad measurement" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-2xl border border-[#E2DAD5] bg-white p-5 text-[#332C28] shadow-xl dark:border-white/15 dark:bg-[#211D1A] dark:text-[#FFF5EF]">
    <h2 className="font-serif text-xl font-semibold">Your privacy, your choice.</h2>
    <p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#D4C7BE]">Optional ad measurement helps us understand which ads bring new members. If you allow it, Meta receives ad/browser identifiers, a hashed email, browser type, and first-payment details. Your fieldwork records, files and supervisor information stay private. <a href="/privacy" className="underline">Privacy details</a></p>
    <div className="mt-4 flex flex-wrap gap-3"><button onClick={() => choose(false)} className="rounded-xl border border-[#A8998E] px-4 py-2.5 text-sm font-semibold">Decline optional measurement</button><button onClick={() => choose(true)} className="rounded-xl bg-[#E85D70] px-4 py-2.5 text-sm font-semibold text-white">Allow ad measurement</button></div>
  </aside>;
}
