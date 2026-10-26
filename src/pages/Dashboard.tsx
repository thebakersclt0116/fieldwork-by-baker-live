import { currentManagedToken } from '@/lib/managedSession';
import FeatureEngagement from '@/components/dashboard/FeatureEngagement';
import MobileAppAnnouncement from '@/components/MobileAppAnnouncement';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  LayoutDashboard,
  Clock,
  CalendarIcon,
  BarChart3,
  FileText,
  Users,
  Sun,
  Bell,
  Zap,
  X,
  Crown,
  LogOut,
  Star,
} from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import OverviewTab from '@/components/dashboard/OverviewTab';
import LogHoursTab from '@/components/dashboard/LogHoursTab';
import CalendarTab from '@/components/dashboard/CalendarTab';
import AnalyticsTab from '@/components/dashboard/AnalyticsTab';
import FormsExportTab from '@/components/dashboard/FormsExportTab';
import SupervisorsTab from '@/components/dashboard/SupervisorsTab';

const tabs = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { id: 'log', label: 'Log Hours', icon: <Clock size={18} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon size={18} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
  { id: 'forms', label: 'Forms Export', icon: <FileText size={18} /> },
  { id: 'supervisors', label: 'Supervisors', icon: <Users size={18} /> },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

/* ------------------------------------------------------------------ */
/*  OWNER ADMIN TAB                                                    */
/* ------------------------------------------------------------------ */

type OwnerReport = { checkedAt: string; metrics: Record<string, number | Record<string, number>>; directory: { page: number; pageSize: number; total: number; users: Array<{ name: string; email: string; registeredAt: string; verified: boolean; lastSignInAt: string | null; subscriptions: Array<{ plan: string; status: string; canceling: boolean }> }> } };
function OwnerAdminTab() {
  const { user } = useAuth();
  const [report, setReport] = useState<OwnerReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const [page, setPage] = useState(1), [status, setStatus] = useState('all');
  const requestSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setBusy(true); setError('');
    try {
      const token = await currentManagedToken();
      const response = await fetch('/api/owner-metrics?page=' + page + '&status=' + status, { cache: 'no-store', signal: AbortSignal.timeout(60000), headers: { Authorization: 'Bearer ' + token } });
      const data = await response.json();
      if (!response.ok || data.version !== 'owner-metrics-v1') throw new Error(data.code === 'OWNER_REQUIRED' ? 'Only the verified cloud owner can view these metrics.' : 'Metrics unavailable. Sign in with your cloud owner account and retry. Unavailable counts are not zero.');
      if (sequence !== requestSequence.current) return;
      setReport(data); setClock(Date.now());
    } catch (failure) { if (sequence === requestSequence.current) setError(failure instanceof Error ? failure.message : 'Metrics unavailable.'); }
    finally { if (sequence === requestSequence.current) setBusy(false); }
  }, [page, status]);
  const invalidate = useCallback(() => { requestSequence.current++; }, []);
  useEffect(() => {
    const initialLoad = window.setTimeout(() => { if (user?.authProvider === 'supabase') void load(); }, 0);
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => { window.clearInterval(timer); window.clearTimeout(initialLoad); invalidate(); };
  }, [user?.email, user?.authProvider, load, invalidate]);
  const stale = report && (Boolean(error) || clock - Date.parse(report.checkedAt) > 300000);
  const labels: Record<string, string> = { registered: 'Registered accounts', verified: 'Verified accounts', free: 'Free verified accounts', legacyTrial: 'Legacy access trials', trial: 'Stripe trial accounts', activePaid: 'Active paid accounts', activeSubscriptions: 'Active paid subscriptions', pastDue: 'Past-due / unpaid paying accounts', canceled: 'Canceled paying accounts', uniquePayers: 'Unique historical payers', scheduledCancellation: 'Active accounts canceling later', otherBilling: 'Other paying billing states' };
  const money = (values: Record<string, number>) => Object.entries(values).map(([currency, cents]) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)).join(' · ') || '0 (no qualifying payments)';
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-2xl">Owner dashboard</h2><p className="text-sm">Live Supabase accounts and Stripe billing · business and account overview</p></div><button type="button" disabled={busy || user?.authProvider !== 'supabase'} onClick={() => void load()} className="rounded-xl bg-[#E85D70] px-4 py-3 text-white disabled:opacity-50">{busy ? 'Loading…' : 'Refresh metrics'}</button></div>
    {user?.authProvider !== 'supabase' && <p role="alert">Your current session is legacy/local and cannot read private owner reports. <Link to="/login?mode=cloud-owner&amp;return=%2Fdashboard" className="underline">Sign in to your cloud owner account</Link>.</p>}
    {busy && <p role="status">Reading current account and billing data…</p>}
    {error && <p role="alert" className="rounded-xl border border-red-400 p-4">{error}</p>}
    {report && <><p role="status" className={stale ? 'text-amber-700' : 'text-sm'}>{stale ? 'Stale snapshot — refresh required. ' : 'Snapshot checked '} {new Date(report.checkedAt).toLocaleString()}. Refresh manually; snapshots become stale after five minutes.</p>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(labels).map(([key, label]) => <div key={key} className="rounded-2xl border border-[#F2EDEA] bg-white p-5 text-[#332C28]"><p className="text-sm">{label}</p><p className="mt-2 text-2xl font-bold">{String(report.metrics[key])}</p></div>)}{[['mrr', 'Current MRR'], ['collected', 'Collected invoice revenue · all time']].map(([key, label]) => <div key={key} className="rounded-2xl border border-[#F2EDEA] bg-white p-5 text-[#332C28]"><p>{label}</p><p className="mt-2 text-xl font-bold">{money(report.metrics[key] as Record<string, number>)}</p></div>)}</div>
    <p className="text-sm">{String(report.metrics.qaAccountsExcluded)} QA accounts excluded · {String(report.metrics.unlinkedBillingAccounts)} paying billing accounts without a matching registered account. Account billing states can overlap when one account has multiple subscriptions.</p></>}
    {report && <section className="rounded-2xl border bg-white p-5 text-[#332C28]"><h3 className="text-xl font-semibold">User directory and subscriptions</h3><label className="my-3 block">Subscription status <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="ml-2 border p-2">{['all', 'active', 'canceled', 'trialing', 'past_due', 'unpaid'].map(value => <option key={value}>{value}</option>)}</select></label><p className="mb-3 text-sm">Catalog billing status is separate from proof of payment. Last sign-in is authentication activity, not feature usage.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Account', 'Registered', 'Last sign-in', 'Plan / status'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{report.directory.users.map(account => <tr key={account.email} className="border-t"><td className="p-2">{account.name || 'No name provided'}<br/>{account.email}<br/>{account.verified ? 'Verified' : 'Unverified'}</td><td className="p-2">{new Date(account.registeredAt).toLocaleDateString()}</td><td className="p-2">{account.lastSignInAt ? new Date(account.lastSignInAt).toLocaleString() : 'Unavailable'}</td><td className="p-2">{account.subscriptions.length ? account.subscriptions.map((sub, index) => <div key={index}>{sub.plan} · {sub.status}{sub.canceling ? ' · scheduled cancellation' : ''}</div>) : 'No catalog subscription'}</td></tr>)}</tbody></table></div><div className="mt-4 flex items-center gap-3"><button disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {report.directory.page} · {report.directory.total} accounts</span><button disabled={busy || page * 50 >= report.directory.total} onClick={() => setPage(value => value + 1)}>Next</button></div></section>}
    <FeatureEngagement />
    <div className="rounded-2xl border p-5 text-sm leading-6"><h3 className="font-semibold">What the numbers mean</h3><p>Registered includes unverified signups; verified counts cloud profiles. Free means no qualifying billing history or current trial, and includes manual/owner access that does not prove payment. Paid accounts require an active catalog subscription with a positive paid invoice in its history; a credited latest invoice does not erase an earlier payment. Unique payers includes canceled customers; subscriptions count separately.</p><p>MRR normalizes current recurring prices and supported discounts to months (annual ÷ 12), excludes trials and past-due subscriptions, and keeps currencies separate. Collected revenue is positive paid invoice amount, all time, including tax, before refunds; it excludes out-of-band payments. Neither is profit or a bank settlement figure. QA/test records and genuinely free subscriptions are excluded from paid metrics. Legacy access trials are shown separately from Stripe trials.</p><Link to="/admin/funnel" className="underline">View first-time acquisition funnel</Link></div>
  </section>;
}

/* ------------------------------------------------------------------ */
/*  MAIN DASHBOARD                                                     */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { user, isOwner, isDemo, isProfessional, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [scrolled, setScrolled] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // If no user at all, we shouldn't be here (App.tsx should guard this)
  // But just in case, show a fallback
  const displayName = user?.name || 'Guest';
  const initials = user?.initials || 'G';

  const dashboardTabs = isOwner
    ? [{ id: 'admin', label: 'Business overview', icon: <Crown size={18} /> }]
    : tabs;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab onTabChange={setActiveTab} />;
      case 'log':
        return <LogHoursTab />;
      case 'calendar':
        return <CalendarTab />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'forms':
        return <FormsExportTab />;
      case 'supervisors':
        return <SupervisorsTab />;
      case 'admin':
        return <OwnerAdminTab />;
      default:
        return <OverviewTab onTabChange={setActiveTab} />;
    }
  };

  if (isOwner) return <main className="min-h-screen bg-[#FFFCF9] px-4 py-8 text-[#332C28]"><div className="mx-auto max-w-7xl"><header className="mb-6 flex justify-between"><Link to="/">Fieldwork by Baker</Link><button onClick={logout}>Sign out</button></header><OwnerAdminTab key={(user?.authProvider || '') + (user?.email || '')} /></div></main>;

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9]">
      {/* Banner: Demo or Owner */}
      {bannerVisible && (
        <>
          {isDemo && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-[72px] left-0 right-0 z-50 bg-[#E85D70] text-white px-4 py-2.5"
            >
              <div className="container-2xl flex items-center justify-center gap-3">
                <Zap size={16} className="shrink-0" />
                <span className="text-sm font-medium">
                  You&apos;re in demo mode — exploring with sample data
                </span>
                <Link
                  to="/signup"
                  className="text-sm font-semibold underline hover:no-underline ml-2"
                >
                  Sign up for free
                </Link>
                <button
                  onClick={() => setBannerVisible(false)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
          {isOwner && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-[72px] left-0 right-0 z-50 bg-[#332C28] text-white px-4 py-2.5"
            >
              <div className="container-2xl flex items-center justify-center gap-3">
                <Crown size={16} className="shrink-0 text-[#D4A574]" />
                <span className="text-sm font-medium">
                  Owner Access — Full platform control enabled
                </span>
                <button
                  onClick={() => setBannerVisible(false)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}

      <div className="container-2xl pt-4"><MobileAppAnnouncement /></div>
      {/* Dashboard Top Bar */}
      <div
        className={`sticky top-[72px] z-40 bg-white/95 backdrop-blur-md border-b border-[#F2EDEA] transition-shadow duration-300 ${
          scrolled ? 'shadow-[0_2px_12px_rgba(0,0,0,0.06)]' : ''
        }`}
      >
        <div className="container-2xl">
          {/* Welcome Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 gap-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-2xl font-semibold text-[#332C28]">
                    {getGreeting()}, {displayName.split(' ')[0]}!
                  </h1>
                  {isOwner && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FBF3EB] text-[#D4A574] text-xs font-semibold border border-[#D4A574]/30 flex items-center gap-1">
                      <Crown size={12} />
                      OWNER
                    </span>
                  )}
                  {isProfessional && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5EE] text-[#7EB89A] text-xs font-semibold border border-[#7EB89A]/30 flex items-center gap-1">
                      <Star size={12} />
                      PRO • ANNUAL
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#A8998E]">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFF5F7]">
                <Sun size={14} className="text-[#E8A838]" />
                <span className="text-xs font-medium text-[#6B5D54]">
                  {isOwner ? 'Owner Dashboard' : isProfessional ? 'Professional • Annual' : '18 months remaining'}
                </span>
              </div>
              <button className="relative p-2.5 rounded-xl text-[#A8998E] hover:text-[#E85D70] hover:bg-[#FFF5F7] transition-colors">
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E85D70]" />
              </button>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isOwner
                      ? 'bg-[#332C28] text-[#D4A574] border-2 border-[#D4A574]/50'
                      : 'bg-[#FFF5F7] text-[#E85D70]'
                  }`}
                >
                  {initials}
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
                          <p className="text-sm font-semibold text-[#332C28]">{displayName}</p>
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
                        <button
                          onClick={logout}
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
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 overflow-x-auto pb-0 -mx-2 px-2 scrollbar-hide">
            {dashboardTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? tab.id === 'admin'
                      ? 'text-[#D4A574]'
                      : 'text-[#E85D70]'
                    : 'text-[#A8998E] hover:text-[#6B5D54] hover:bg-[#FAF8F6]'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${
                      tab.id === 'admin' ? 'bg-[#D4A574]' : 'bg-[#E85D70]'
                    }`}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="container-2xl py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
