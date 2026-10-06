import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router';
import PlatformNavbar from './PlatformNavbar';
import Footer from './Footer';
import TrackedHoursEditor from './TrackedHoursEditor';
import RipleyQuickLog from './RipleyQuickLog';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [fieldworkVersion, setFieldworkVersion] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [location.pathname]);
  useEffect(() => {
    const refresh = () => setFieldworkVersion((value) => value + 1);
    window.addEventListener('fieldwork:entries-changed', refresh);
    return () => window.removeEventListener('fieldwork:entries-changed', refresh);
  }, []);

  const toggleDark = useCallback(() => setIsDark((prev) => !prev), []);

  return (
    <div className={`min-h-[100dvh] flex flex-col ${isDark ? 'dark' : ''}`}>
      <PlatformNavbar isDark={isDark} onToggleDark={toggleDark} />
      <main className="flex-1 pt-[72px]" key={`${location.pathname}:${['/import', '/audit-history'].includes(location.pathname) ? 'records' : fieldworkVersion}`}>
        {['/dashboard', '/export'].includes(location.pathname) && <nav aria-label="Fieldwork records" className="flex flex-wrap justify-center gap-4 border-b border-[#F2EDEA] bg-[#FFFCF9] p-3 text-sm dark:border-white/10 dark:bg-[#171412]"><Link className="font-semibold text-[#E85D70] underline" to="/import">Migrate every original entry</Link><Link className="font-semibold text-[#E85D70] underline" to="/audit-history">Audit history & original documents</Link></nav>}
        {children}</main>
      <RipleyQuickLog />
      <TrackedHoursEditor />
      <Footer />
    </div>
  );
}
