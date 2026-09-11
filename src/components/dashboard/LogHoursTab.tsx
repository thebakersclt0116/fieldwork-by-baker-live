import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Clock,
  CalendarIcon,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  MapPin,
  FileText,
  ChevronDown,
  User,
  Briefcase,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { mockSupervisors, mockHourEntries } from '@/data/mockData';
import StatusBadge from './StatusBadge';

const unrestrictedActivities = [
  'Observation & Data Collection',
  'Staff/Caregiver Training',
  'Conducting Assessments',
  'Client Meetings',
  'Functional Analyses',
  'Data Graphing & Analysis',
  'Literature Research',
  'Program Writing/Revising',
];

const restrictedActivities = [
  'Direct Therapy Implementation',
  'Instructional Procedures',
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function LogHoursTab() {
  const [date, setDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [fieldworkType, setFieldworkType] = useState<'SUPERVISED' | 'CONCENTRATED'>('SUPERVISED');
  const [activityCategory, setActivityCategory] = useState<'UNRESTRICTED' | 'RESTRICTED'>('UNRESTRICTED');
  const [activitySubcategory, setActivitySubcategory] = useState('');
  const [supervisorId, setSupervisorId] = useState('s_001');
  const [setting, setSetting] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const calculatedDuration = (() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return Math.max(0, eh + em / 60 - sh - sm / 60);
  })();

  const startTimer = () => {
    if (isTimerRunning) return;
    setIsTimerRunning(true);
    const interval = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  const pauseTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    setIsTimerRunning(false);
  };

  const resetTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    setIsTimerRunning(false);
    setTimerSeconds(0);
  };

  const formatTimer = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setStartTime('');
        setEndTime('');
        setActivitySubcategory('');
        setSetting('');
        setNotes('');
        resetTimer();
      }, 2000);
    }, 800);
  };

  const todayEntries = mockHourEntries.filter(
    (e) => e.date === format(new Date(), 'yyyy-MM-dd')
  );

  const activities = activityCategory === 'UNRESTRICTED' ? unrestrictedActivities : restrictedActivities;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="flex items-center gap-3 bg-[#E8F5EE] text-[#7EB89A] rounded-2xl px-6 py-4 border border-[rgba(126,184,154,0.3)]"
          >
            <CheckCircle2 size={22} />
            <div>
              <p className="font-medium text-sm">Hours logged successfully!</p>
              <p className="text-xs opacity-80">Your entry has been saved and is pending supervisor verification.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer Widget */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-[#332C28] text-sm">Quick Timer</h4>
            <p className="text-xs text-[#A8998E]">Track hours in real-time</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="font-mono text-3xl font-medium text-[#332C28] tracking-tight">
              {formatTimer(timerSeconds)}
            </div>
            <div className="flex items-center gap-1.5">
              {!isTimerRunning ? (
                <button
                  onClick={startTimer}
                  className="p-2.5 rounded-xl bg-[#E8F5EE] text-[#7EB89A] hover:bg-[#d4edde] transition-colors"
                >
                  <Play size={18} />
                </button>
              ) : (
                <button
                  onClick={pauseTimer}
                  className="p-2.5 rounded-xl bg-[#FFF3E0] text-[#E8A838] hover:bg-[#ffe8c4] transition-colors"
                >
                  <Pause size={18} />
                </button>
              )}
              <button
                onClick={resetTimer}
                className="p-2.5 rounded-xl bg-[#F2EDEA] text-[#A8998E] hover:bg-[#e8e0db] transition-colors"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Form */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-xl font-semibold text-[#332C28]">
            Log Fieldwork Hours
          </h3>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFF5F7] text-[#E85D70] text-sm font-medium hover:bg-[#FFE0E6] transition-colors">
                <CalendarIcon size={16} />
                {format(date, 'MMM d, yyyy')}
                <ChevronDown size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-5">
          {/* Time Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#4D423C] mb-2">
                Start Time
              </label>
              <div className="relative">
                <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9BDB5]" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4D423C] mb-2">
                End Time
              </label>
              <div className="relative">
                <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9BDB5]" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* Calculated Duration */}
          {calculatedDuration > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFF5F7] text-sm"
            >
              <Clock size={14} className="text-[#E85D70]" />
              <span className="text-[#6B5D54]">
                Duration: <strong className="text-[#332C28]">{calculatedDuration.toFixed(1)} hours</strong>
              </span>
            </motion.div>
          )}

          {/* Fieldwork Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-[#4D423C] mb-2">
              Fieldwork Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#FAF8F6]">
              <button
                onClick={() => setFieldworkType('SUPERVISED')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  fieldworkType === 'SUPERVISED'
                    ? 'bg-white text-[#E85D70] shadow-sm'
                    : 'text-[#A8998E] hover:text-[#6B5D54]'
                }`}
              >
                <Briefcase size={14} />
                Supervised
              </button>
              <button
                onClick={() => setFieldworkType('CONCENTRATED')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  fieldworkType === 'CONCENTRATED'
                    ? 'bg-white text-[#E85D70] shadow-sm'
                    : 'text-[#A8998E] hover:text-[#6B5D54]'
                }`}
              >
                <Briefcase size={14} />
                Concentrated
              </button>
            </div>
          </div>

          {/* Activity Category */}
          <div>
            <label className="block text-sm font-medium text-[#4D423C] mb-2">
              Activity Category
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#FAF8F6]">
              <button
                onClick={() => {
                  setActivityCategory('UNRESTRICTED');
                  setActivitySubcategory('');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activityCategory === 'UNRESTRICTED'
                    ? 'bg-white text-[#7EB89A] shadow-sm'
                    : 'text-[#A8998E] hover:text-[#6B5D54]'
                }`}
              >
                <TrendingUp size={14} />
                Unrestricted
              </button>
              <button
                onClick={() => {
                  setActivityCategory('RESTRICTED');
                  setActivitySubcategory('');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activityCategory === 'RESTRICTED'
                    ? 'bg-white text-[#E8A838] shadow-sm'
                    : 'text-[#A8998E] hover:text-[#6B5D54]'
                }`}
              >
                <TrendingDown size={14} />
                Restricted
              </button>
            </div>
          </div>

          {/* Activity Subcategory */}
          <div>
            <label className="block text-sm font-medium text-[#4D423C] mb-2">
              Activity Subcategory
            </label>
            <div className="relative">
              <select
                value={activitySubcategory}
                onChange={(e) => setActivitySubcategory(e.target.value)}
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none appearance-none"
              >
                <option value="">Select an activity...</option>
                {activities.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C9BDB5] pointer-events-none" />
            </div>
          </div>

          {/* Supervisor */}
          <div>
            <label className="block text-sm font-medium text-[#4D423C] mb-2">
              Supervisor
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9BDB5]" />
              <select
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none appearance-none"
              >
                {mockSupervisors.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.displayName} — {sup.certificationNumber}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C9BDB5] pointer-events-none" />
            </div>
          </div>

          {/* Setting */}
          <div>
            <label className="block text-sm font-medium text-[#4D423C] mb-2">
              Setting / Location
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C9BDB5]" />
              <input
                type="text"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                placeholder="e.g., Clinic, School, Home"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm placeholder:text-[#C9BDB5] focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#4D423C] mb-2">
              Notes <span className="text-[#C9BDB5] font-normal">(optional)</span>
            </label>
            <div className="relative">
              <FileText size={16} className="absolute left-3.5 top-3.5 text-[#C9BDB5]" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional details..."
                rows={3}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm placeholder:text-[#C9BDB5] focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none resize-none"
              />
            </div>
          </div>

          {/* Submit */}
          <motion.button
            onClick={handleSubmit}
            disabled={isSubmitting || !startTime || !endTime || !activitySubcategory}
            whileHover={{ y: -2 }}
            whileTap={{ y: 0 }}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-250 ${
              isSubmitting || !startTime || !endTime || !activitySubcategory
                ? 'bg-[#F2EDEA] text-[#C9BDB5] cursor-not-allowed'
                : 'text-white shadow-[0_4px_16px_rgba(233,93,112,0.3)] hover:shadow-[0_8px_24px_rgba(233,93,112,0.35)]'
            }`}
            style={
              !(isSubmitting || !startTime || !endTime || !activitySubcategory)
                ? { background: 'linear-gradient(135deg, #E85D70 0%, #F97B8A 100%)' }
                : undefined
            }
          >
            {isSubmitting ? 'Logging...' : 'Log Hours'}
          </motion.button>
        </div>
      </motion.div>

      {/* Today's Entries */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      >
        <h3 className="font-serif text-lg font-semibold text-[#332C28] mb-4">
          Today&apos;s Entries ({todayEntries.length})
        </h3>
        {todayEntries.length === 0 ? (
          <p className="text-sm text-[#A8998E] text-center py-6">
            No entries logged today yet. Start tracking!
          </p>
        ) : (
          <div className="space-y-3">
            {todayEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#FAF8F6]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      entry.activityCategory === 'UNRESTRICTED' ? 'bg-[#7EB89A]' : 'bg-[#E8A838]'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-[#4D423C]">
                      {entry.activityType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                    <p className="text-xs text-[#A8998E]">
                      {entry.startTime} — {entry.endTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium text-[#332C28]">
                    {entry.duration}h
                  </span>
                  <StatusBadge status={entry.status === 'VERIFIED' ? 'success' : 'pending'}>
                    {entry.status === 'VERIFIED' ? 'Verified' : 'Pending'}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
