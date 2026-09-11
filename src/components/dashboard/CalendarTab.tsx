import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  eachDayOfInterval,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { mockHourEntries } from '@/data/mockData';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function CalendarTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 0, 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Compute hours per day from mock entries
  const hoursByDate = useMemo(() => {
    const map: Record<string, { total: number; unrestricted: number; restricted: number; entries: typeof mockHourEntries }> = {};
    mockHourEntries.forEach((entry) => {
      if (!map[entry.date]) {
        map[entry.date] = { total: 0, unrestricted: 0, restricted: 0, entries: [] };
      }
      map[entry.date].total += entry.duration;
      if (entry.activityCategory === 'UNRESTRICTED') {
        map[entry.date].unrestricted += entry.duration;
      } else {
        map[entry.date].restricted += entry.duration;
      }
      map[entry.date].entries.push(entry);
    });
    return map;
  }, []);

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedDayData = selectedDateStr ? hoursByDate[selectedDateStr] : null;

  // Monthly summary
  const monthSummary = useMemo(() => {
    let total = 0;
    let unrestricted = 0;
    let restricted = 0;
    Object.entries(hoursByDate).forEach(([dateStr, data]) => {
      const d = new Date(dateStr);
      if (isSameMonth(d, currentMonth)) {
        total += data.total;
        unrestricted += data.unrestricted;
        restricted += data.restricted;
      }
    });
    return { total, unrestricted, restricted };
  }, [hoursByDate, currentMonth]);

  const getDayIntensity = (date: Date) => {
    const str = format(date, 'yyyy-MM-dd');
    const data = hoursByDate[str];
    if (!data) return null;
    if (data.total >= 6) return 'high';
    if (data.total >= 3) return 'medium';
    return 'low';
  };

  const getDayHours = (date: Date) => {
    const str = format(date, 'yyyy-MM-dd');
    return hoursByDate[str]?.total ?? 0;
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {/* Calendar */}
      <motion.div
        variants={itemVariants}
        className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-xl font-semibold text-[#332C28]">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-xl hover:bg-[#F2EDEA] text-[#6B5D54] transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FFF5F7] text-[#E85D70] hover:bg-[#FFE0E6] transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-xl hover:bg-[#F2EDEA] text-[#6B5D54] transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Week headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-[#A8998E] uppercase tracking-wider py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const intensity = getDayIntensity(day);
            const dayHours = getDayHours(day);

            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedDate(day)}
                className={`
                  relative aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200
                  ${!isCurrentMonth ? 'text-[#C9BDB5]' : 'text-[#332C28]'}
                  ${isSelected ? 'ring-2 ring-[#E85D70] bg-[#FFF5F7]' : ''}
                  ${isToday && !isSelected ? 'bg-[#E8F5EE]' : ''}
                  ${!isSelected && !isToday && isCurrentMonth ? 'hover:bg-[#FAF8F6]' : ''}
                `}
              >
                <span className={`text-sm font-medium ${isToday ? 'text-[#7EB89A]' : ''}`}>
                  {format(day, 'd')}
                </span>
                {intensity && (
                  <div className="flex items-center gap-0.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        intensity === 'high'
                          ? 'bg-[#E85D70]'
                          : intensity === 'medium'
                          ? 'bg-[#F97B8A]'
                          : 'bg-[#FFC1CC]'
                      }`}
                    />
                  </div>
                )}
                {dayHours > 0 && (
                  <span className="text-[10px] text-[#A8998E] font-mono">{dayHours}h</span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#F2EDEA]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#FFC1CC]" />
            <span className="text-xs text-[#A8998E]">1-2 hrs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#F97B8A]" />
            <span className="text-xs text-[#A8998E]">3-5 hrs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#E85D70]" />
            <span className="text-xs text-[#A8998E]">6+ hrs</span>
          </div>
        </div>
      </motion.div>

      {/* Sidebar */}
      <motion.div variants={itemVariants} className="space-y-6">
        {/* Month Summary */}
        <div className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <h4 className="font-serif text-lg font-semibold text-[#332C28] mb-4">
            {format(currentMonth, 'MMMM')} Summary
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B5D54]">Total Hours</span>
              <span className="font-mono text-lg font-medium text-[#332C28]">
                {monthSummary.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#7EB89A]">Unrestricted</span>
              <span className="font-mono text-sm font-medium text-[#7EB89A]">
                {monthSummary.unrestricted}h
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#E8A838]">Restricted</span>
              <span className="font-mono text-sm font-medium text-[#E8A838]">
                {monthSummary.restricted}h
              </span>
            </div>
            <div className="w-full h-2 bg-[#F2EDEA] rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-[#E85D70]"
                style={{
                  width: `${Math.min((monthSummary.total / 130) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-[#A8998E]">
              {monthSummary.total} of 130 max hours
            </p>
          </div>
        </div>

        {/* Selected Day Details */}
        <div className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <h4 className="font-serif text-lg font-semibold text-[#332C28] mb-4">
            {selectedDate
              ? format(selectedDate, 'EEEE, MMM d')
              : 'Select a day'}
          </h4>
          {selectedDayData ? (
            <div className="space-y-3">
              {selectedDayData.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-[#FAF8F6]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#E85D70]">
                      {entry.startTime} — {entry.endTime}
                    </span>
                    <span className="font-mono text-sm font-medium text-[#332C28]">
                      {entry.duration}h
                    </span>
                  </div>
                  <p className="text-sm text-[#4D423C]">
                    {entry.activityType
                      .replace(/_/g, ' ')
                      .toLowerCase()
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        entry.activityCategory === 'UNRESTRICTED'
                          ? 'bg-[#E8F5EE] text-[#7EB89A]'
                          : 'bg-[#FFF3E0] text-[#E8A838]'
                      }`}
                    >
                      {entry.activityCategory}
                    </span>
                    <span className="text-[10px] text-[#A8998E]">
                      {entry.supervisorName}
                    </span>
                  </div>
                </div>
              ))}
              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FFF5F7] text-[#E85D70] text-sm font-medium hover:bg-[#FFE0E6] transition-colors">
                <Plus size={14} />
                Add Entry
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock size={28} className="mx-auto text-[#E2DAD5] mb-2" />
              <p className="text-sm text-[#A8998E]">
                {selectedDate
                  ? 'No entries for this day'
                  : 'Click a day to view details'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
