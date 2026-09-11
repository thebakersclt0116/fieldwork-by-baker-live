import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Award,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  X,
  Shield,
  TrendingUp,
  Timer,
} from 'lucide-react';
import { format } from 'date-fns';
import { mockSupervisors, mockHourEntries } from '@/data/mockData';
import StatusBadge from './StatusBadge';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const pendingRequests = [
  {
    id: 'req_001',
    supervisorName: 'Dr. Emily Chen',
    type: 'Verification Request',
    sentAt: '2025-01-20T09:00:00Z',
    status: 'PENDING' as const,
    message: 'Monthly verification for January 2025',
  },
];

export default function SupervisorsTab() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSupervisorName, setNewSupervisorName] = useState('');
  const [newSupervisorEmail, setNewSupervisorEmail] = useState('');
  const [newSupervisorBACB, setNewSupervisorBACB] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  // Calculate hours per supervisor from mock data
  const supervisorStats = mockSupervisors.map((sup) => {
    const supEntries = mockHourEntries.filter((e) => e.supervisorId === sup.id);
    const totalHours = supEntries.reduce((sum, e) => sum + e.duration, 0);
    const thisMonthHours = supEntries
      .filter((e) => e.date.startsWith('2025-01'))
      .reduce((sum, e) => sum + e.duration, 0);
    return { ...sup, totalHours, thisMonthHours, entryCount: supEntries.length };
  });

  const handleSendRequest = () => {
    setRequestSent(true);
    setTimeout(() => {
      setRequestSent(false);
      setShowAddForm(false);
      setNewSupervisorName('');
      setNewSupervisorEmail('');
      setNewSupervisorBACB('');
    }, 2000);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header with Add Button */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h3 className="font-serif text-xl font-semibold text-[#332C28]">
            My Supervisors
          </h3>
          <p className="text-sm text-[#A8998E]">
            Manage your supervisor connections and verification requests
          </p>
        </div>
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 0 }}
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white shadow-[0_4px_16px_rgba(233,93,112,0.3)] hover:shadow-[0_8px_24px_rgba(233,93,112,0.35)] transition-all"
          style={{ background: 'linear-gradient(135deg, #E85D70 0%, #F97B8A 100%)' }}
        >
          {showAddForm ? <X size={16} /> : <Plus size={16} />}
          {showAddForm ? 'Cancel' : 'Add Supervisor'}
        </motion.button>
      </motion.div>

      {/* Add Supervisor Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <h4 className="font-medium text-[#332C28] mb-4">Send Supervisor Invitation</h4>
          {requestSent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 text-[#7EB89A] py-4"
            >
              <CheckCircle2 size={22} />
              <p className="text-sm font-medium">Invitation sent successfully!</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4D423C] mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newSupervisorName}
                  onChange={(e) => setNewSupervisorName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="w-full px-4 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm placeholder:text-[#C9BDB5] focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4D423C] mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9BDB5]" />
                  <input
                    type="email"
                    value={newSupervisorEmail}
                    onChange={(e) => setNewSupervisorEmail(e.target.value)}
                    placeholder="supervisor@email.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm placeholder:text-[#C9BDB5] focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4D423C] mb-2">
                  BACB Number
                </label>
                <div className="relative">
                  <Award size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9BDB5]" />
                  <input
                    type="text"
                    value={newSupervisorBACB}
                    onChange={(e) => setNewSupervisorBACB(e.target.value)}
                    placeholder="1-23-45678"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm placeholder:text-[#C9BDB5] focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none"
                  />
                </div>
              </div>
              <div className="sm:col-span-3">
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  onClick={handleSendRequest}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border-2 border-[#E2DAD5] text-[#6B5D54] hover:border-[#E85D70] hover:text-[#E85D70] hover:bg-[#FFF5F7] transition-all"
                >
                  <Send size={16} />
                  Send Invitation
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Supervisor Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {supervisorStats.map((sup) => (
          <motion.div
            key={sup.id}
            variants={itemVariants}
            whileHover={{ y: -4 }}
            className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(30,26,24,0.1)] transition-shadow duration-350"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#FFF5F7] flex items-center justify-center text-base font-semibold text-[#E85D70]">
                  {sup.displayName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <h4 className="font-medium text-[#332C28]">{sup.displayName}</h4>
                  <div className="flex items-center gap-2 text-xs text-[#A8998E]">
                    <Mail size={12} />
                    {sup.email}
                  </div>
                </div>
              </div>
              <StatusBadge status={sup.isActive ? 'success' : 'warning'}>
                {sup.isActive ? 'Active' : 'Inactive'}
              </StatusBadge>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-xl bg-[#FAF8F6]">
                <div className="flex items-center justify-center gap-1 text-[#E85D70] mb-1">
                  <Timer size={14} />
                </div>
                <div className="font-mono text-lg font-medium text-[#332C28]">
                  {sup.totalHours}h
                </div>
                <div className="text-[10px] text-[#A8998E]">Total Hours</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-[#FAF8F6]">
                <div className="flex items-center justify-center gap-1 text-[#7EB89A] mb-1">
                  <TrendingUp size={14} />
                </div>
                <div className="font-mono text-lg font-medium text-[#332C28]">
                  {sup.thisMonthHours}h
                </div>
                <div className="text-[10px] text-[#A8998E]">This Month</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-[#FAF8F6]">
                <div className="flex items-center justify-center gap-1 text-[#6BA3D6] mb-1">
                  <Shield size={14} />
                </div>
                <div className="font-mono text-lg font-medium text-[#332C28]">
                  {sup.entryCount}
                </div>
                <div className="text-[10px] text-[#A8998E]">Entries</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#F2EDEA]">
              <div className="flex items-center gap-1.5 text-xs text-[#A8998E]">
                <Award size={12} />
                BACB: {sup.certificationNumber || 'N/A'}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-[#E85D70] bg-[#FFF5F7] hover:bg-[#FFE0E6] transition-colors"
              >
                <Send size={12} />
                Request Verification
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <h3 className="font-serif text-lg font-semibold text-[#332C28] mb-4">
            Pending Requests
          </h3>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-[#FFF5F7] border border-[#FFE0E6]"
              >
                <div className="p-2 rounded-lg bg-[#FFE0E6]">
                  <Clock size={18} className="text-[#E85D70]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#4D423C]">{req.type}</p>
                  <p className="text-xs text-[#A8998E]">{req.message}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#A8998E]">
                    {format(new Date(req.sentAt), 'MMM d')}
                  </span>
                  <StatusBadge status="pending">Pending</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
