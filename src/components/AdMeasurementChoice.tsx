import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { withAcquisitionQuery } from '@/lib/acquisitionFunnel';
import { captureAdClick, readAdChoice, saveAdChoice } from '@/lib/adMeasurement';
const PUBLIC_PATHS = new Set(['/', '/start', '/login', '/demo', '/pricing', '/features', '/about', '/faq', '/contact', '/privacy', '/cookies', '/terms', '/security', '/signup', '/upgrade']);
export default function AdMeasurementChoice() {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(() => !readAdChoice());
  const [enabled, setEnabled] = useState(false);
  const noticeRef = useRef<HTMLElement | null>(null);
  useEffect(() => { let active = true; fetch('/api/ad-measurement-config', { cache: 'no-store' }).then(r => r.json()).then(data => { if (active) setEnabled(data.enabled === true); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { if (PUBLIC_PATHS.has(pathname)) captureAdClick(); }, [pathname, search]);
  useLayoutEffect(() => {
    const notice = noticeRef.current;
    if (!enabled || !PUBLIC_PATHS.has(pathname) || !notice) return;
    const root = document.documentElement;
    const properties = ['--baker-ad-choice-space', 'scroll-padding-bottom'];
    const previous = properties.map(property => [root.style.getPropertyValue(property), root.style.getPropertyPriority(property)]);
    const reserveSpace = () => {
      const space = `${Math.ceil(notice.getBoundingClientRect().height) + 32}px`;
      root.style.setProperty(properties[0], space);
      root.style.setProperty(properties[1], space);
    };
    reserveSpace();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reserveSpace);
    observer?.observe(notice);
    window.addEventListener('resize', reserveSpace);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', reserveSpace);
      properties.forEach((property, index) => {
        const [value, priority] = previous[index];
        if (value) root.style.setProperty(property, value, priority);
        else root.style.removeProperty(property);
      });
    };
  }, [enabled, open, pathname]);
  if (!enabled || !PUBLIC_PATHS.has(pathname)) return null;
  if (!open) return <button ref={notice => { noticeRef.current = notice; }} onClick={() => setOpen(true)} className="fixed bottom-3 left-3 z-40 rounded-full border border-[#E2DAD5] bg-white px-3 py-2 text-xs text-[#6B5D54] shadow-sm dark:border-white/15 dark:bg-[#211D1A] dark:text-[#EADFD7]">Ad privacy</button>;
  const choose = (allowed: boolean) => { saveAdChoice(allowed); setOpen(false); };
  return <aside ref={noticeRef} aria-label="Optional ad measurement" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-h-[50dvh] max-w-xl overflow-y-auto rounded-2xl border border-[#E2DAD5] bg-white p-5 text-[#332C28] shadow-xl dark:border-white/15 dark:bg-[#211D1A] dark:text-[#FFF5EF]">
    <h2 className="font-serif text-xl font-semibold">Your privacy, your choice.</h2>
    <p className="mt-2 text-sm leading-6 text-[#6B5D54] dark:text-[#D4C7BE]">Optional ad measurement sends Meta public-page visits, account creation, confirmed email, checkout and first-payment events, plus ad/browser identifiers, browser type and a hashed email when available. Your fieldwork records, files and supervisor information are never included. Declining does not affect your account. <Link to={withAcquisitionQuery('/privacy', search)} className="underline">Privacy details</Link></p>
    <div className="mt-4 flex flex-wrap gap-3"><button onClick={() => choose(false)} className="rounded-xl border border-[#A8998E] px-4 py-2.5 text-sm font-semibold">Decline optional measurement</button><button onClick={() => choose(true)} className="rounded-xl bg-[#E85D70] px-4 py-2.5 text-sm font-semibold text-white">Allow ad measurement</button></div>
  </aside>;
}
