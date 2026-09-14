import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';
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
      <main className="flex-1 pt-[72px]" key={`${location.pathname}:${fieldworkVersion}`}>{children}</main>
      <RipleyQuickLog />
      <TrackedHoursEditor />
      <Footer />
    </div>
  );
}
