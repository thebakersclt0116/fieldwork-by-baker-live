import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { TrendingUp, Award, Target, Zap, Star, Trophy } from 'lucide-react';
import ProgressRing from './ProgressRing';
import { mockUser } from '@/data/mockData';

const cumulativeData = [
  { month: 'Aug 24', hours: 890 },
  { month: 'Sep 24', hours: 1020 },
  { month: 'Oct 24', hours: 1148 },
  { month: 'Nov 24', hours: 1230 },
  { month: 'Dec 24', hours: 1340 },
  { month: 'Jan 25', hours: 1247 },
];

const activityBreakdown = [
  { activity: 'Direct Therapy', hours: 320, color: '#F97B8A' },
  { activity: 'Behavior Plans', hours: 245, color: '#E85D70' },
  { activity: 'Assessments', hours: 198, color: '#FFC1CC' },
  { activity: 'Supervision', hours: 156, color: '#7EB89A' },
  { activity: 'Training', hours: 134, color: '#E8A838' },
  { activity: 'Research', hours: 89, color: '#6BA3D6' },
  { activity: 'Data Analysis', hours: 105, color: '#C9BDB5' },
];

const supervisorData = [
  { name: 'Dr. Emily Chen', hours: 720, color: '#F97B8A' },
  { name: 'Dr. Marcus Johnson', hours: 527, color: '#E85D70' },
];

const pieData = [
  { name: 'Unrestricted', value: mockUser.unrestrictedHours, color: '#F97B8A' },
  { name: 'Restricted', value: mockUser.restrictedHours, color: '#E8A838' },
];

const milestones = [
  { id: 'm100', label: '100 Hours', threshold: 100, icon: <Award size={20} /> },
  { id: 'm500', label: '500 Hours', threshold: 500, icon: <Star size={20} /> },
  { id: 'm1000', label: '1,000 Hours', threshold: 1000, icon: <Trophy size={20} /> },
  { id: 'm1500', label: '1,500 Hours', threshold: 1500, icon: <Zap size={20} /> },
  { id: 'm2000', label: '2,000 Hours', threshold: 2000, icon: <Target size={20} /> },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const streakDays = Array.from({ length: 126 }, (_, i) => {
  const patterns = [0, 0, 0, 1, 2, 3, 4, 0, 1, 1, 0, 2, 3, 4];
  const hasEntry = Math.random() > 0.15;
  const intensity = hasEntry ? patterns[i % patterns.length] : 0;
  return { day: i, intensity };
});

export default function AnalyticsTab() {
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);

  const totalHours = mockUser.hoursLogged;
  const unrestrictedPct = (mockUser.unrestrictedHours / totalHours) * 100;
  const percentageComplete = (totalHours / mockUser.targetHours) * 100;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Progress Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex flex-col items-center"
        >
          <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-2">
            Progress Overview
          </h3>
          <p className="text-sm text-[#A8998E] mb-6">
            Projected completion: <span className="font-medium text-[#7EB89A]">August 2025</span>
          </p>
          <ProgressRing percentage={percentageComplete} size={200} strokeWidth={12} label="Complete" />
          <div className="mt-6 grid grid-cols-2 gap-4 text-center w-full">
            <div>
              <div className="font-mono text-lg font-medium text-[#332C28]">{totalHours.toLocaleString()}</div>
              <div className="text-xs text-[#A8998E]">Total Hours</div>
            </div>
            <div>
              <div className="font-mono text-lg font-medium text-[#7EB89A]">{unrestrictedPct.toFixed(1)}%</div>
              <div className="text-xs text-[#A8998E]">Unrestricted</div>
            </div>
          </div>
        </motion.div>

        {/* Hours Trend */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-6">
            Hours Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97B8A" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#F97B8A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2EDEA" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A8998E', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A8998E', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #F2EDEA',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}
              />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="#E85D70"
                strokeWidth={2.5}
                fill="url(#areaGradient)"
                animationDuration={1200}
              />
              {/* Target line reference */}
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-4 text-xs text-[#A8998E]">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-[#7EB89A]" />
              <span>
                On pace for <strong className="text-[#332C28]">Aug 2025</strong> completion
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Target size={14} className="text-[#E85D70]" />
              <span>
                Target: <strong className="text-[#332C28]">2,000 hours</strong>
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Row: Pie + Supervisor Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unrestricted vs Restricted Pie */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-6">
            Unrestricted vs Restricted
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                animationDuration={1000}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #F2EDEA',
                  borderRadius: '12px',
                }}
                formatter={(value: number) => [`${value} hours`, '']}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: '#A8998E' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center mt-2">
            <p className="text-sm text-[#A8998E]">
              Unrestricted ratio:{' '}
              <span
                className={`font-medium ${unrestrictedPct >= 60 ? 'text-[#7EB89A]' : 'text-[#E8A838]'}`}
              >
                {unrestrictedPct.toFixed(1)}%
              </span>{' '}
              {unrestrictedPct >= 60 ? '(meets requirement)' : '(below 60%)'}
            </p>
          </div>
        </motion.div>

        {/* Hours by Supervisor */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-6">
            Hours by Supervisor
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={supervisorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F2EDEA" horizontal={false} />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A8998E', fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B5D54', fontSize: 12 }}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #F2EDEA',
                  borderRadius: '12px',
                }}
              />
              <Bar dataKey="hours" radius={[0, 8, 8, 0]} animationDuration={1000}>
                {supervisorData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Activity Breakdown + Streak */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Breakdown */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-6">
            Activity Breakdown
          </h3>
          <div className="space-y-3">
            {activityBreakdown.map((activity) => (
              <div key={activity.activity}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[#6B5D54]">{activity.activity}</span>
                  <span className="text-sm font-mono font-medium text-[#332C28]">
                    {activity.hours}h
                  </span>
                </div>
                <div className="w-full h-2 bg-[#F2EDEA] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: activity.color }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(activity.hours / 320) * 100}%`,
                    }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Streak Calendar (GitHub-style) */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-xl font-semibold text-[#332C28]">
              Activity Streak
            </h3>
            <span className="text-sm text-[#A8998E]">
              <strong className="text-[#332C28]">12</strong> day streak
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {streakDays.map((day) => {
              const colors = [
                'bg-[#F2EDEA]',
                'bg-[#FFE0E6]',
                'bg-[#FFC1CC]',
                'bg-[#F97B8A]',
                'bg-[#E85D70]',
              ];
              return (
                <motion.div
                  key={day.day}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2, delay: day.day * 0.003 }}
                  className={`w-3.5 h-3.5 rounded-sm ${colors[day.intensity]} transition-transform hover:scale-125`}
                  title={`Day ${day.day + 1}: ${day.intensity > 0 ? day.intensity + ' hours' : 'No activity'}`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-4 text-xs text-[#A8998E]">
            <span>Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-sm ${
                    ['bg-[#F2EDEA]', 'bg-[#FFE0E6]', 'bg-[#FFC1CC]', 'bg-[#F97B8A]', 'bg-[#E85D70]'][i]
                  }`}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </motion.div>
      </div>

      {/* Milestones */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      >
        <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-6">
          Milestones
        </h3>
        <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap">
          {milestones.map((milestone) => {
            const earned = totalHours >= milestone.threshold;
            return (
              <motion.div
                key={milestone.id}
                whileHover={{ scale: 1.1 }}
                onHoverStart={() => setHoveredMilestone(milestone.id)}
                onHoverEnd={() => setHoveredMilestone(null)}
                className="relative flex flex-col items-center cursor-pointer"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                    earned
                      ? 'bg-[#FBF3EB] text-[#D4A574] shadow-[0_4px_16px_rgba(212,165,116,0.3)]'
                      : 'bg-[#FAF8F6] text-[#C9BDB5] border-2 border-dashed border-[#E2DAD5]'
                  }`}
                >
                  {milestone.icon}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    earned ? 'text-[#D4A574]' : 'text-[#C9BDB5]'
                  }`}
                >
                  {milestone.label}
                </span>
                {earned && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#7EB89A] flex items-center justify-center"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                )}
                {hoveredMilestone === milestone.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-[#332C28] text-white text-xs whitespace-nowrap z-10"
                  >
                    {earned ? 'Earned!' : `${milestone.threshold - totalHours} hours to go`}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
