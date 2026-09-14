import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Compass, FlaskConical, Library, LogOut, Menu, Moon, Route, Sparkles, Sun, Users, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const coreNav = [
  { label: 'My Path', href: '/my-path', icon: Compass },
  { label: 'BCBA Roadmap', href: '/roadmap', icon: Route },
  { label: 'Baker Commons', href: '/commons', icon: Users },
  { label: 'Baker Brain', href: '/baker-brain', icon: Brain },
  { label: 'Exam Lab', href: '/exam-lab', icon: FlaskConical },
  { label: 'Resource Vault', href: '/resources', icon: Library },
];

export default function PlatformNavbar({ isDark, onToggleDark }: { isDark: boolean; onToggleDark: () => void }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); setProfileOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const active = (href: string) => location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 h-[72px] border-b border-[#F2EDEA]/80 bg-[#FFFCF9]/92 backdrop-blur-xl dark:bg-[#171412]/92 dark:border-white/10">
        <div className="mx-auto flex h-full max-w-[1500px] items-center justify-between gap-4 px-4 lg:px-6">
          <Link to="/" className="flex shrink-0 items-baseline gap-1">
            <span className="font-serif text-[22px] font-bold text-[#332C28] dark:text-[#F8F4F1]">Fieldwork</span>
            <span className="text-sm font-semibold text-[#E85D70]">by Baker</span>
          </Link>

          <div className="hidden xl:flex min-w-0 flex-1 items-center justify-center gap-0.5">
            {coreNav.map(({ label, href, icon: Icon }) => (
              <Link key={href} to={href} className={`group flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition ${active(href) ? 'bg-[#FFF0F3] text-[#D94D62] dark:bg-[#E85D70]/15 dark:text-[#FF8EA0]' : 'text-[#6B5D54] hover:bg-white hover:text-[#E85D70] dark:text-[#CFC4BE] dark:hover:bg-white/5'}`}>
                <Icon size={14} className="shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            ))}
          </div>

          <div className="hidden xl:flex shrink-0 items-center gap-2">
            <button onClick={onToggleDark} aria-label="Toggle dark mode" className="rounded-xl p-2.5 text-[#6B5D54] hover:bg-white hover:text-[#E85D70] dark:text-[#CFC4BE] dark:hover:bg-white/5">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {isAuthenticated ? (
              <div className="relative">
                <button onClick={() => setProfileOpen((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#332C28] text-xs font-bold text-[#F4C895] ring-2 ring-[#D4A574]/25">
                  {user?.initials || 'BB'}
                </button>
                <AnimatePresence>
                  {profileOpen && (
                    <>
                      <button className="fixed inset-0 z-40 cursor-default" onClick={() => setProfileOpen(false)} aria-label="Close profile menu" />
                      <motion.div initial={{ opacity: 0, y: -6, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: .97 }} className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-[#F2EDEA] bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#211D1A]">
                        <div className="border-b border-[#F2EDEA] px-3 py-3 dark:border-white/10">
                          <div className="text-sm font-semibold text-[#332C28] dark:text-white">{user?.name}</div>
                          <div className="truncate text-xs text-[#A8998E]">{user?.email}</div>
                        </div>
                        <Link to="/dashboard" className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[#6B5D54] hover:bg-[#FFF5F7] dark:text-[#CFC4BE] dark:hover:bg-white/5"><Sparkles size={15} /> Fieldwork workspace</Link>
                        <Link to="/pricing" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[#6B5D54] hover:bg-[#FFF5F7] dark:text-[#CFC4BE] dark:hover:bg-white/5">Membership & billing</Link>
                        <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-[#6B5D54] hover:bg-[#FFF5F7] hover:text-[#E85D70] dark:text-[#CFC4BE] dark:hover:bg-white/5"><LogOut size={15} /> Sign out</button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-[#6B5D54] dark:text-[#CFC4BE]">Sign in</Link>
                <Link to="/signup" className="rounded-xl bg-[#E85D70] px-4 py-2.5 text-sm font-semibold text-white shadow-sm">Start My BCBA Journey</Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 xl:hidden">
            <button onClick={onToggleDark} aria-label="Toggle dark mode" className="rounded-xl p-2.5 text-[#6B5D54] dark:text-[#CFC4BE]">{isDark ? <Sun size={19} /> : <Moon size={19} />}</button>
            <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-xl p-2.5 text-[#332C28] dark:text-white"><Menu size={22} /></button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm xl:hidden" aria-label="Close navigation" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="fixed inset-y-0 right-0 z-50 w-[340px] max-w-[90vw] overflow-y-auto bg-[#FFFCF9] p-5 shadow-2xl dark:bg-[#171412] xl:hidden">
              <div className="mb-6 flex items-center justify-between">
                <div><div className="font-serif text-xl font-bold text-[#332C28] dark:text-white">Fieldwork <span className="text-sm font-sans text-[#E85D70]">by Baker</span></div><div className="text-xs text-[#A8998E]">Your BCBA home base</div></div>
                <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-[#6B5D54] dark:text-[#CFC4BE]"><X size={21} /></button>
              </div>
              <div className="space-y-1">
                {coreNav.map(({ label, href, icon: Icon }) => (
                  <Link key={href} to={href} className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold ${active(href) ? 'bg-[#FFF0F3] text-[#D94D62] dark:bg-[#E85D70]/15 dark:text-[#FF8EA0]' : 'text-[#4D423C] hover:bg-white dark:text-[#E5DDD8] dark:hover:bg-white/5'}`}><Icon size={18} />{label}</Link>
                ))}
              </div>
              <div className="my-6 h-px bg-[#F2EDEA] dark:bg-white/10" />
              {isAuthenticated ? (
                <div className="space-y-2">
                  <div className="rounded-2xl bg-white p-4 dark:bg-white/5"><div className="text-sm font-semibold text-[#332C28] dark:text-white">{user?.name}</div><div className="truncate text-xs text-[#A8998E]">{user?.email}</div></div>
                  <Link to="/dashboard" className="block rounded-xl px-4 py-3 text-sm font-semibold text-[#6B5D54] dark:text-[#CFC4BE]">Fieldwork workspace</Link>
                  <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#E85D70]"><LogOut size={17} /> Sign out</button>
                </div>
              ) : (
                <div className="grid gap-2"><Link to="/signup" className="rounded-xl bg-[#E85D70] px-4 py-3 text-center text-sm font-semibold text-white">Start My BCBA Journey</Link><Link to="/login" className="rounded-xl border border-[#E2DAD5] px-4 py-3 text-center text-sm font-semibold text-[#6B5D54] dark:text-[#CFC4BE]">Sign in</Link></div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
