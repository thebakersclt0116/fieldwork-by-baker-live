/**
 * Supervisor View
 * A simplified dashboard for supervisors who receive email invites.
 * They can view supervisee hours, approve/reject, and add correction notes.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  Mail,
  User,
  Shield,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Link } from 'react-router';

/* ------------------------------------------------------------------ */
/*  MOCK DATA                                                          */
/* ------------------------------------------------------------------ */

interface HourEntry {
  id: string;
  date: string;
  hours: number;
  type: string;
  activity: string;
  category: 'Unrestricted' | 'Restricted';
  status: 'pending' | 'approved' | 'rejected';
  supervisorNote?: string;
  superviseeNote?: string;
}

const mockSupervisee = {
  name: 'Sarah Chen',
  email: 'sarah.chen@email.com',
  totalHours: 1247,
  unrestrictedHours: 802,
  restrictedHours: 445,
  unrestrictedPercent: 64.3,
  startDate: '2024-01-15',
  targetHours: 2000,
};

const mockEntries: HourEntry[] = [
  { id: '1', date: '2025-01-15', hours: 3, type: 'Supervised', activity: 'Observation and Data Collection', category: 'Unrestricted', status: 'approved', supervisorNote: 'Great detailed notes on the session.' },
  { id: '2', date: '2025-01-15', hours: 2.5, type: 'Supervised', activity: 'Direct Therapy Implementation', category: 'Restricted', status: 'approved' },
  { id: '3', date: '2025-01-16', hours: 2.5, type: 'Supervised', activity: 'Assessment Administration', category: 'Unrestricted', status: 'pending' },
  { id: '4', date: '2025-01-17', hours: 1, type: 'Supervised', activity: 'Supervision Meeting', category: 'Unrestricted', status: 'pending' },
  { id: '5', date: '2025-01-18', hours: 4, type: 'Supervised', activity: 'Program Writing and Revision', category: 'Unrestricted', status: 'pending', superviseeNote: 'Worked on revising the behavior intervention plan for Client A.' },
  { id: '6', date: '2025-01-20', hours: 1.5, type: 'Supervised', activity: 'Data Graphing and Analysis', category: 'Unrestricted', status: 'pending' },
  { id: '7', date: '2025-01-21', hours: 2, type: 'Concentrated', activity: 'Parent Training Session', category: 'Unrestricted', status: 'rejected', supervisorNote: 'Please specify which parent training curriculum was used and attach the signed training log.', superviseeNote: 'Used the RUBI curriculum. Will attach log.' },
];

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function SupervisorView() {
  const [entries, setEntries] = useState<HourEntry[]>(mockEntries);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [showEmailPreview, setShowEmailPreview] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'approved' } : e));
    setShowEmailPreview('approved');
    setTimeout(() => setShowEmailPreview(null), 3000);
  };

  const handleReject = (id: string) => {
    const note = noteDraft[id]?.trim();
    if (!note) {
      setExpandedEntry(id);
      return;
    }
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'rejected', supervisorNote: note } : e));
    setShowEmailPreview('corrections');
    setTimeout(() => setShowEmailPreview(null), 3000);
    setNoteDraft(prev => ({ ...prev, [id]: '' }));
  };

  const pendingCount = entries.filter(e => e.status === 'pending').length;
  const approvedCount = entries.filter(e => e.status === 'approved').length;
  const rejectedCount = entries.filter(e => e.status === 'rejected').length;

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9]">
      {/* Header Banner */}
      <div className="bg-[#332C28] text-white py-4">
        <div className="container-2xl flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-xl font-bold">Fieldwork</span>
            <span className="text-sm text-[#D4A574]">by Baker</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#A8998E]">
            <Shield size={14} className="text-[#D4A574]" />
            Supervisor Portal
          </div>
        </div>
      </div>

      <div className="container-2xl py-8">
        {/* Supervisee Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#FFF5F7] flex items-center justify-center text-[#E85D70] font-semibold text-lg">
                SC
              </div>
              <div>
                <h2 className="font-semibold text-[#332C28] text-lg">{mockSupervisee.name}</h2>
                <p className="text-sm text-[#A8998E]">{mockSupervisee.email}</p>
                <p className="text-xs text-[#C4B7AD] mt-0.5">Tracking since {mockSupervisee.startDate}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center px-4 py-2 bg-[#FAF8F6] rounded-xl">
                <p className="text-xl font-bold text-[#332C28]">{mockSupervisee.totalHours}</p>
                <p className="text-[10px] text-[#A8998E] uppercase tracking-wider">Total Hours</p>
              </div>
              <div className="text-center px-4 py-2 bg-[#E8F5EE]/30 rounded-xl">
                <p className="text-xl font-bold text-[#7EB89A]">{mockSupervisee.unrestrictedPercent}%</p>
                <p className="text-[10px] text-[#A8998E] uppercase tracking-wider">Unrestricted</p>
              </div>
              <div className="text-center px-4 py-2 bg-[#FBF3EB]/50 rounded-xl">
                <p className="text-xl font-bold text-[#D4A574]">{mockSupervisee.targetHours - mockSupervisee.totalHours}</p>
                <p className="text-[10px] text-[#A8998E] uppercase tracking-wider">Hours Left</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 border border-[#F2EDEA] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF8F0] flex items-center justify-center text-[#E8A838]">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-lg font-bold text-[#332C28]">{pendingCount}</p>
              <p className="text-xs text-[#A8998E]">Pending Review</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#F2EDEA] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F5EE] flex items-center justify-center text-[#7EB89A]">
              <CheckCircle size={18} />
            </div>
            <div>
              <p className="text-lg font-bold text-[#332C28]">{approvedCount}</p>
              <p className="text-xs text-[#A8998E]">Approved</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#F2EDEA] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF5F7] flex items-center justify-center text-[#E85D70]">
              <AlertCircle size={18} />
            </div>
            <div>
              <p className="text-lg font-bold text-[#332C28]">{rejectedCount}</p>
              <p className="text-xs text-[#A8998E]">Corrections Needed</p>
            </div>
          </div>
        </div>

        {/* Email Notification Previews */}
        <AnimatePresence>
          {showEmailPreview === 'approved' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-[#E8F5EE] border border-[#7EB89A]/30 flex items-center gap-3"
            >
              <Mail size={18} className="text-[#7EB89A]" />
              <div>
                <p className="text-sm font-medium text-[#332C28]">Email sent to Sarah</p>
                <p className="text-xs text-[#7EB89A]">&quot;Your hours have been approved by your supervisor!&quot;</p>
              </div>
            </motion.div>
          )}
          {showEmailPreview === 'corrections' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-[#FFF8F0] border border-[#E8A838]/30 flex items-center gap-3"
            >
              <Mail size={18} className="text-[#E8A838]" />
              <div>
                <p className="text-sm font-medium text-[#332C28]">Email sent to Sarah</p>
                <p className="text-xs text-[#E8A838]">&quot;Corrections needed on your recent hours — see supervisor notes.&quot;</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Entries List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-[#332C28] mb-2">Hours Awaiting Review</h3>
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              layout
              className={`bg-white rounded-2xl border transition-all ${
                entry.status === 'rejected'
                  ? 'border-[#E85D70]/30'
                  : entry.status === 'approved'
                  ? 'border-[#7EB89A]/30'
                  : 'border-[#F2EDEA]'
              }`}
            >
              {/* Entry Header */}
              <div
                className="p-5 flex items-center gap-4 cursor-pointer"
                onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  entry.status === 'approved'
                    ? 'bg-[#E8F5EE] text-[#7EB89A]'
                    : entry.status === 'rejected'
                    ? 'bg-[#FFF5F7] text-[#E85D70]'
                    : 'bg-[#FFF8F0] text-[#E8A838]'
                }`}>
                  {entry.status === 'approved' ? <CheckCircle size={18} /> :
                   entry.status === 'rejected' ? <XCircle size={18} /> :
                   <Clock size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-[#332C28]">{entry.date}</p>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                      entry.category === 'Unrestricted'
                        ? 'bg-[#E8F5EE] text-[#7EB89A]'
                        : 'bg-[#FFF5F7] text-[#E85D70]'
                    }`}>
                      {entry.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#A8998E] truncate">{entry.activity}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#332C28]">{entry.hours} hrs</p>
                  <p className="text-[10px] text-[#A8998E]">{entry.type}</p>
                </div>
                {expandedEntry === entry.id ? <ChevronUp size={16} className="text-[#A8998E]" /> :
                 <ChevronDown size={16} className="text-[#A8998E]" />}
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedEntry === entry.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-[#F2EDEA]">
                      {/* Supervisee Note */}
                      {entry.superviseeNote && (
                        <div className="mt-4 p-3 rounded-xl bg-[#FAF8F6]">
                          <p className="text-xs font-medium text-[#A8998E] mb-1 flex items-center gap-1">
                            <User size={12} /> Supervisee Note
                          </p>
                          <p className="text-sm text-[#6B5D54]">{entry.superviseeNote}</p>
                        </div>
                      )}

                      {/* Supervisor Note */}
                      {entry.supervisorNote && (
                        <div className="mt-3 p-3 rounded-xl bg-[#FFF5F7]">
                          <p className="text-xs font-medium text-[#E85D70] mb-1 flex items-center gap-1">
                            <Shield size={12} /> Your Note
                          </p>
                          <p className="text-sm text-[#6B5D54]">{entry.supervisorNote}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {entry.status === 'pending' && (
                        <div className="mt-4 space-y-3">
                          <div>
                            <label className="text-xs font-medium text-[#A8998E] mb-1.5 block flex items-center gap-1">
                              <MessageSquare size={12} />
                              Add a note (optional for approval, required for corrections)
                            </label>
                            <textarea
                              value={noteDraft[entry.id] || ''}
                              onChange={(e) => setNoteDraft(prev => ({ ...prev, [entry.id]: e.target.value }))}
                              placeholder="Example: Please add more detail about the observation setting..."
                              className="w-full px-4 py-3 rounded-xl border border-[#F2EDEA] text-sm text-[#332C28] placeholder:text-[#C4B7AD] focus:outline-none focus:border-[#E85D70] focus:ring-2 focus:ring-[#E85D70]/10 resize-none"
                              rows={2}
                            />
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleApprove(entry.id)}
                              className="flex-1 py-2.5 rounded-xl bg-[#E8F5EE] text-[#7EB89A] font-medium text-sm hover:bg-[#7EB89A] hover:text-white transition-colors flex items-center justify-center gap-2"
                            >
                              <CheckCircle size={16} />
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(entry.id)}
                              className="flex-1 py-2.5 rounded-xl bg-[#FFF5F7] text-[#E85D70] font-medium text-sm hover:bg-[#E85D70] hover:text-white transition-colors flex items-center justify-center gap-2"
                            >
                              <XCircle size={16} />
                              Request Corrections
                            </button>
                          </div>
                        </div>
                      )}

                      {entry.status === 'rejected' && (
                        <div className="mt-4 p-3 rounded-xl bg-[#FFF5F7]/50 border border-[#E85D70]/20">
                          <p className="text-xs text-[#E85D70] font-medium mb-1">Waiting for supervisee to resubmit</p>
                          <p className="text-xs text-[#A8998E]">Sarah will receive an email notification with your correction notes.</p>
                        </div>
                      )}

                      {entry.status === 'approved' && (
                        <div className="mt-4 p-3 rounded-xl bg-[#E8F5EE]/50 border border-[#7EB89A]/20">
                          <p className="text-xs text-[#7EB89A] font-medium mb-1">Approved on {new Date().toLocaleDateString()}</p>
                          <p className="text-xs text-[#A8998E]">Sarah has been notified via email.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-[#C4B7AD]">
            Supervisor Portal • Fieldwork by Baker
          </p>
          <Link to="/" className="text-xs text-[#E85D70] hover:underline mt-1 inline-block">
            Visit our website
          </Link>
        </div>
      </div>
    </div>
  );
}
