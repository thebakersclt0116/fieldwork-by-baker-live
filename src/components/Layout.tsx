import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';
import PlatformNavbar from './PlatformNavbar';
import Footer from './Footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [location.pathname]);
  const toggleDark = useCallback(() => setIsDark((prev) => !prev), []);

  return (
    <div className={`min-h-[100dvh] flex flex-col ${isDark ? 'dark' : ''}`}>
      <PlatformNavbar isDark={isDark} onToggleDark={toggleDark} />
      <main className="flex-1 pt-[172px] sm:pt-[124px] lg:pt-20" key={location.pathname}>
        {window.location.hostname === 'fieldwork-by-baker-testing.vercel.app' && <aside role="note" className="m-3 rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-900/20 dark:text-amber-100"><strong>Temporary recovery address.</strong> Your usual domain’s locally saved hours are not visible on this separate address. Do not clear browser data or re-import real hours here to compensate. This address is useful for diagnostics; return to <a className="underline" href="https://www.fieldworkbybaker.com">your usual Fieldwork site</a> once its domain is restored.</aside>}
        {children}</main>
      <Footer />
    </div>
  );
}
