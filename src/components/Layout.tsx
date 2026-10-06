import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import PlatformNavbar from './PlatformNavbar';
import Footer from './Footer';
import TrackedHoursEditor from './TrackedHoursEditor';
import RipleyQuickLog from './RipleyQuickLog';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const stored = localStorage.getItem('theme'); if (stored) return stored === 'dark'; } catch { /* browser preference is still usable */ }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [fieldworkVersion, setFieldworkVersion] = useState(0);
  const location = useLocation();
  const alternateOrigin = window.location.hostname === 'fieldwork-by-baker-testing.vercel.app';
  const emily = user?.email?.trim().toLowerCase() === 'ayalaemily52@gmail.com';
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark'); else root.classList.remove('dark');
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch { /* don't crash rendering when preference storage fails */ }
  }, [isDark]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [location.pathname]);
  useEffect(() => {
    const refresh = () => setFieldworkVersion(value => value + 1);
    window.addEventListener('fieldwork:entries-changed', refresh);
    return () => window.removeEventListener('fieldwork:entries-changed', refresh);
  }, []);
  const toggleDark = useCallback(() => setIsDark(prev => !prev), []);
  return (
    <div className={`min-h-[100dvh] flex flex-col ${isDark ? 'dark' : ''}`}>
      <PlatformNavbar isDark={isDark} onToggleDark={toggleDark} />
      <main className="flex-1 pt-[72px]" key={`${location.pathname}:${['/import', '/audit-history', '/reset-fieldwork'].includes(location.pathname) ? 'records' : fieldworkVersion}`}>
        {alternateOrigin && <div role="note" className="border-b border-amber-400/30 bg-amber-50 px-5 py-3 text-center text-sm leading-6 text-amber-950 dark:bg-amber-900/20 dark:text-amber-100"><strong>Temporary Vercel address.</strong> Records on your usual www.fieldworkbybaker.com address are stored separately in your browser. A blank ledger here does not mean your original hours were deleted. Return to the original domain after verification is restored.</div>}
        {['/dashboard', '/export', '/import', '/audit-history'].includes(location.pathname) && <nav aria-label="Fieldwork records" className="flex flex-wrap justify-center gap-4 border-b border-[#F2EDEA] bg-[#FFFCF9] p-3 text-sm dark:border-white/10 dark:bg-[#171412]"><Link className="font-semibold text-[#E85D70] underline" to="/import">Migrate every original entry</Link><Link className="font-semibold text-[#E85D70] underline" to="/audit-history">Audit history & original documents</Link>{emily && <Link className="font-semibold text-[#C9445A] underline" to="/reset-fieldwork">Reset tracked hours for re-import</Link>}</nav>}
        {children}
      </main>
      <RipleyQuickLog />
      <TrackedHoursEditor />
      <Footer />
    </div>
  );
}
