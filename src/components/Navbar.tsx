import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Moon,
  Menu,
  X,
  ArrowRight,
  LogOut,
  LayoutDashboard,
  Crown,
  Star,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Enterprise', href: '/enterprise' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

interface NavbarProps {
  isDark: boolean;
  onToggleDark: () => void;
}

export default function Navbar({ isDark, onToggleDark }: NavbarProps) {
  const { user, isAuthenticated, isOwner, isProfessional, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    setShowProfileMenu(false);
  }, [location.pathname]);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return location.pathname === '/';
      return location.pathname.startsWith(href);
    },
    [location.pathname]
  );

  const isDashboard = location.pathname === '/dashboard';

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-[72px] flex items-center transition-all duration-300 ${
          scrolled
            ? 'glass-navbar border-b border-warm-gray-200/50 shadow-nav'
            : 'bg-transparent'
        } ${isDark ? 'dark' : ''}`}
      >
        <div className="container-2xl w-full flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-baseline gap-1 shrink-0">
            <span className="font-serif text-2xl font-bold text-warm-gray-900 dark:text-[var(--dark-text)]">
              Fieldwork
            </span>
            <span className="text-sm font-medium text-rose-500">by Baker</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`px-3 py-2 text-[15px] font-medium rounded-lg transition-colors duration-200 ${
                  isActive(link.href)
                    ? 'text-rose-500'
                    : 'text-warm-gray-600 hover:text-rose-500 dark:text-[var(--dark-text-secondary)] dark:hover:text-[var(--dark-rose)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={onToggleDark}
              className="p-2 rounded-xl text-warm-gray-500 hover:text-rose-500 hover:bg-rose-50 dark:text-[var(--dark-text-secondary)] dark:hover:text-[var(--dark-rose)] dark:hover:bg-[var(--dark-rose-soft)] transition-colors duration-200"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {isAuthenticated ? (
              /* Logged-in user nav */
              <>
                <Link
                  to="/dashboard"
                  className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isDashboard
                      ? 'text-rose-500'
                      : 'text-warm-gray-600 hover:text-rose-500'
                  }`}
                >
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>
                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      isOwner
                        ? 'bg-[#332C28] text-[#D4A574] border-2 border-[#D4A574]/50'
                        : isProfessional
                        ? 'bg-[#E8F5EE] text-[#7EB89A] border-2 border-[#7EB89A]/50'
                        : 'bg-[#FFF5F7] text-[#E85D70]'
                    }`}
                  >
                    {user?.initials}
                  </button>
                  <AnimatePresence>
                    {showProfileMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowProfileMenu(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-lg border border-[#F2EDEA] z-50 py-2"
                        >
                          <div className="px-4 py-3 border-b border-[#F2EDEA]">
                            <p className="text-sm font-semibold text-[#332C28]">{user?.name}</p>
                            <p className="text-xs text-[#A8998E]">{user?.email}</p>
                            {isOwner && (
                              <p className="text-xs text-[#D4A574] font-medium mt-0.5 flex items-center gap-1">
                                <Crown size={10} /> Platform Owner
                              </p>
                            )}
                            {isProfessional && (
                              <p className="text-xs text-[#7EB89A] font-medium mt-0.5 flex items-center gap-1">
                                <Star size={10} /> Professional • Annual
                              </p>
                            )}
                          </div>
                          <Link
                            to="/dashboard"
                            onClick={() => setShowProfileMenu(false)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#6B5D54] hover:bg-[#FFF5F7] transition-colors"
                          >
                            <LayoutDashboard size={16} />
                            Dashboard
                          </Link>
                          <button
                            onClick={() => { setShowProfileMenu(false); logout(); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#6B5D54] hover:bg-[#FFF5F7] hover:text-[#E85D70] transition-colors"
                          >
                            <LogOut size={16} />
                            Sign Out
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              /* Guest nav */
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-warm-gray-600 hover:text-rose-500 transition-colors"
                >
                  Try Demo
                </Link>
                <Link
                  to="/signup"
                  className="btn-primary text-sm py-2.5 px-5 rounded-xl"
                >
                  Get Started
                  <ArrowRight size={16} />
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={onToggleDark}
              className="p-2 rounded-xl text-warm-gray-500 hover:text-rose-500 hover:bg-rose-50 dark:text-[var(--dark-text-secondary)] transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-xl text-warm-gray-700 hover:bg-warm-gray-100 dark:text-[var(--dark-text)] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="fixed top-0 right-0 bottom-0 w-[320px] max-w-[85vw] bg-white dark:bg-dark-surface z-50 shadow-modal lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-warm-gray-100 dark:border-dark-border">
                <Link to="/" className="flex items-baseline gap-1" onClick={() => setMobileOpen(false)}>
                  <span className="font-serif text-xl font-bold text-warm-gray-900 dark:text-[var(--dark-text)]">
                    Fieldwork
                  </span>
                  <span className="text-xs font-medium text-rose-500">by Baker</span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg text-warm-gray-500 hover:bg-warm-gray-100 dark:text-[var(--dark-text-secondary)] transition-colors"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Auth section */}
              {isAuthenticated && (
                <div className="px-6 py-4 border-b border-warm-gray-100 dark:border-dark-border bg-[#FFF5F7]/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isOwner
                        ? 'bg-[#332C28] text-[#D4A574]'
                        : isProfessional
                        ? 'bg-[#E8F5EE] text-[#7EB89A]'
                        : 'bg-[#FFF5F7] text-[#E85D70]'
                    }`}>
                      {user?.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#332C28]">{user?.name}</p>
                      <p className="text-xs text-[#A8998E]">{user?.email}</p>
                      {isProfessional && (
                        <p className="text-xs text-[#7EB89A] font-medium mt-0.5">Professional • Annual</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col py-4">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 + 0.1 }}
                  >
                    <Link
                      to={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`px-6 py-3.5 text-[16px] font-medium transition-colors ${
                        isActive(link.href)
                          ? 'text-rose-500 bg-rose-50 dark:bg-[var(--dark-rose-soft)]'
                          : 'text-warm-gray-700 hover:text-rose-500 hover:bg-warm-gray-50 dark:text-[var(--dark-text)] dark:hover:bg-dark-elevated'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}

                {isAuthenticated && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <Link
                        to="/dashboard"
                        onClick={() => setMobileOpen(false)}
                        className="px-6 py-3.5 text-[16px] font-medium text-rose-500 bg-rose-50 flex items-center gap-2"
                      >
                        <LayoutDashboard size={18} />
                        Dashboard
                      </Link>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.55 }}
                    >
                      <button
                        onClick={() => { setMobileOpen(false); logout(); }}
                        className="w-full text-left px-6 py-3.5 text-[16px] font-medium text-warm-gray-700 hover:text-rose-500 hover:bg-warm-gray-50 flex items-center gap-2"
                      >
                        <LogOut size={18} />
                        Sign Out
                      </button>
                    </motion.div>
                  </>
                )}
              </div>
              {!isAuthenticated && (
                <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-warm-gray-100 dark:border-dark-border">
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="btn-primary w-full"
                  >
                    Get Started
                    <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
