import { useState, useEffect } from 'react';
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
  Shield,
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

function OwnerAdminTab() {
  return (
    <div className="space-y-6">
      {/* Platform Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: '1,247', change: '+12% this month', color: 'rose' },
          { label: 'Active Subscriptions', value: '892', change: '+8% this month', color: 'green' },
          { label: 'Enterprise Clients', value: '34', change: '+3 this month', color: 'gold' },
          { label: 'Monthly Revenue', value: '$18,420', change: '+15% this month', color: 'blue' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-sm"
          >
            <p className="text-xs text-[#A8998E] font-medium uppercase tracking-wider mb-2">{stat.label}</p>
            <p className="text-2xl font-bold text-[#332C28] mb-1">{stat.value}</p>
            <p className="text-xs text-[#7EB89A] font-medium">{stat.change}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-[#D4A574]" />
            <h3 className="font-semibold text-[#332C28]">Platform Administration</h3>
          </div>
          <div className="space-y-2">
            {['Manage Users', 'View Subscriptions', 'Enterprise Clients', 'System Settings', 'Export All Data'].map((action) => (
              <button
                key={action}
                className="w-full text-left px-4 py-3 rounded-xl text-sm text-[#6B5D54] hover:bg-[#FFF5F7] hover:text-[#E85D70] transition-colors border border-transparent hover:border-[#FFC1CC]"
              >
                {action}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Crown size={18} className="text-[#D4A574]" />
            <h3 className="font-semibold text-[#332C28]">Owner Controls</h3>
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-[#FBF3EB]/50 border border-[#D4A574]/20">
              <p className="text-sm font-medium text-[#6B5D54] mb-1">Subscription Tiers</p>
              <p className="text-xs text-[#A8998E]">Individual ($12), Professional ($24), Enterprise (Custom)</p>
            </div>
            <div className="p-4 rounded-xl bg-[#FFF5F7]/50 border border-[#FFC1CC]/30">
              <p className="text-sm font-medium text-[#6B5D54] mb-1">Payment Methods</p>
              <p className="text-xs text-[#A8998E]">Apple Pay, Credit/Debit, Google Pay — Stripe processing</p>
            </div>
            <div className="p-4 rounded-xl bg-[#E8F5EE]/50 border border-[#7EB89A]/20">
              <p className="text-sm font-medium text-[#6B5D54] mb-1">Compliance Status</p>
              <p className="text-xs text-[#A8998E]">BACB 2027 Compliant, HIPAA Ready, SOC 2 Pending</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
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
    ? [...tabs, { id: 'admin', label: 'Admin', icon: <Crown size={18} /> }]
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
