import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Clock,
  FileOutput,
  Users,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Timer,
  TrendingUp,
  ChevronRight,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router';
import ProgressRing from './ProgressRing';
import StatusBadge from './StatusBadge';
import { mockHourEntries, mockUser } from '@/data/mockData';

const monthlyData = [
  { month: 'Aug', unrestricted: 68, restricted: 42 },
  { month: 'Sep', unrestricted: 72, restricted: 38 },
  { month: 'Oct', unrestricted: 85, restricted: 45 },
  { month: 'Nov', unrestricted: 78, restricted: 35 },
  { month: 'Dec', unrestricted: 92, restricted: 48 },
  { month: 'Jan', unrestricted: 88, restricted: 39 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'VERIFIED':
      return <CheckCircle2 size={14} className="text-[#7EB89A]" />;
    case 'PENDING':
      return <Clock size={14} className="text-[#E8A838]" />;
    case 'DRAFT':
      return <AlertCircle size={14} className="text-[#6BA3D6]" />;
    default:
      return <AlertCircle size={14} className="text-[#D4626A]" />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'VERIFIED':
      return 'Verified';
    case 'PENDING':
      return 'Pending';
    case 'DRAFT':
      return 'Draft';
    default:
      return 'Rejected';
  }
};

const getCategoryBadgeStyle = (category: string) => {
  return category === 'UNRESTRICTED'
    ? 'bg-[#E8F5EE] text-[#7EB89A]'
    : 'bg-[#FFF3E0] text-[#E8A838]';
};

interface OverviewTabProps {
  onTabChange: (tab: string) => void;
}

export default function OverviewTab({ onTabChange }: OverviewTabProps) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const recentEntries = mockHourEntries.slice(0, 8);
  const totalHours = mockUser.hoursLogged;
  const unrestrictedHours = mockUser.unrestrictedHours;
  const percentageComplete = (totalHours / mockUser.targetHours) * 100;
  const unrestrictedPct = (unrestrictedHours / totalHours) * 100;

  const complianceItems = [
    {
      label: 'Monthly Hours (20-130)',
      value: '87 hours',
      status: 'success' as const,
      message: 'Within range',
    },
    {
      label: 'Unrestricted Ratio (>=60%)',
      value: `${unrestrictedPct.toFixed(1)}%`,
      status: unrestrictedPct >= 60 ? ('success' as const) : ('warning' as const),
      message: unrestrictedPct >= 60 ? 'On target' : 'Below 60%',
    },
    {
      label: 'Supervision Contacts (>=4/mo)',
      value: '4 contacts',
      status: 'success' as const,
      message: 'Complete',
    },
    {
      label: 'Observations (>=1/mo)',
      value: '2 observations',
      status: 'success' as const,
      message: 'Complete',
    },
    {
      label: '5-Year Deadline',
      value: '18 months left',
      status: 'info' as const,
      message: 'On pace',
    },
  ];

  const quickActions = [
    { label: 'Log Hours', icon: <Clock size={20} />, tab: 'log' },
    { label: 'Export Form', icon: <FileOutput size={20} />, tab: 'forms' },
    { label: 'Add Supervisor', icon: <Users size={20} />, tab: 'supervisors' },
    { label: 'View Analytics', icon: <BarChart3 size={20} />, tab: 'analytics' },
    { label: 'Import Hours', icon: <Upload size={20} />, href: '/import' },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-[#FFF5F7] text-[#E85D70]">
              <Timer size={18} />
            </div>
            <span className="text-xs font-medium text-[#7EB89A]">+24 this week</span>
          </div>
          <div className="font-mono text-[32px] font-medium text-[#332C28] leading-none mb-1">
            {totalHours.toLocaleString()}
          </div>
          <p className="text-sm text-[#A8998E]">of {mockUser.targetHours.toLocaleString()} hours</p>
          <div className="mt-3 w-full h-2 bg-[#F2EDEA] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(135deg, #F97B8A 0%, #E85D70 100%)' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(percentageComplete, 100)}%` }}
              transition={{ duration: 1, delay: 0.3 }}
            />
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-[#E8F5EE] text-[#7EB89A]">
              <TrendingUp size={18} />
            </div>
            <StatusBadge status={unrestrictedPct >= 60 ? 'success' : 'warning'}>
              {unrestrictedPct >= 60 ? 'On Track' : 'Below Target'}
            </StatusBadge>
          </div>
          <div className="font-mono text-[32px] font-medium text-[#332C28] leading-none mb-1">
            {unrestrictedPct.toFixed(1)}%
          </div>
          <p className="text-sm text-[#A8998E]">Unrestricted (min 60%)</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-[#EBF4FA] text-[#6BA3D6]">
              <Users size={18} />
            </div>
            <StatusBadge status="success">Complete</StatusBadge>
          </div>
          <div className="font-mono text-[32px] font-medium text-[#332C28] leading-none mb-1">
            4
          </div>
          <p className="text-sm text-[#A8998E]">of 4 required this month</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-[#FFF3E0] text-[#E8A838]">
              <Clock size={18} />
            </div>
            <StatusBadge status="info">On pace</StatusBadge>
          </div>
          <div className="font-mono text-[32px] font-medium text-[#332C28] leading-none mb-1">
            87
          </div>
          <p className="text-sm text-[#A8998E]">of 130 max this month</p>
        </motion.div>
      </div>

      {/* Main Content: Progress Ring + Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Ring */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex flex-col items-center"
        >
          <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-6">
            Overall Progress
          </h3>
          <ProgressRing
            percentage={percentageComplete}
            size={240}
            strokeWidth={14}
            label="Complete"
            subLabel={`Unrestricted: ${unrestrictedPct.toFixed(1)}%`}
          />
          <div className="mt-8 grid grid-cols-3 gap-6 text-center w-full">
            <div>
              <div className="font-mono text-lg font-medium text-[#332C28]">
                {(mockUser.targetHours - totalHours).toLocaleString()}
              </div>
              <div className="text-xs text-[#A8998E]">Hours Remaining</div>
            </div>
            <div>
              <div className="font-mono text-lg font-medium text-[#7EB89A]">
                Aug 2025
              </div>
              <div className="text-xs text-[#A8998E]">Est. Completion</div>
            </div>
            <div>
              <div className="font-mono text-lg font-medium text-[#E85D70]">
                145/mo
              </div>
              <div className="text-xs text-[#A8998E]">Current Pace</div>
            </div>
          </div>
        </motion.div>

        {/* Monthly Hours Bar Chart */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-8 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-6">
            Monthly Hours
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData} barGap={4}>
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
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: '#A8998E' }}
              />
              <Bar
                dataKey="unrestricted"
                name="Unrestricted"
                fill="#F97B8A"
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
              />
              <Bar
                dataKey="restricted"
                name="Restricted"
                fill="#E8A838"
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
                animationBegin={200}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recent Entries + Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Entries Table */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl font-semibold text-[#332C28]">
              Recent Entries
            </h3>
            <button
              onClick={() => onTabChange('log')}
              className="text-sm font-medium text-[#E85D70] hover:text-[#C9445A] flex items-center gap-1 transition-colors"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2EDEA]">
                  <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3 pr-4">
                    Date
                  </th>
                  <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3 pr-4">
                    Type
                  </th>
                  <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3 pr-4">
                    Activity
                  </th>
                  <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3 pr-4">
                    Hours
                  </th>
                  <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3 pr-4">
                    Supervisor
                  </th>
                  <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-[#F2EDEA]/50 transition-colors duration-150 ${
                      hoveredRow === idx ? 'bg-[#FFFCF9]' : ''
                    }`}
                    onMouseEnter={() => setHoveredRow(idx)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="py-3 pr-4 text-sm text-[#6B5D54]">
                      {new Date(entry.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeStyle(
                          entry.activityCategory
                        )}`}
                      >
                        {entry.activityCategory === 'UNRESTRICTED' ? 'Unrestricted' : 'Restricted'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-sm text-[#6B5D54]">
                      {entry.activityType
                        .replace(/_/g, ' ')
                        .toLowerCase()
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </td>
                    <td className="py-3 pr-4 text-sm font-medium text-[#332C28]">
                      {entry.duration}
                    </td>
                    <td className="py-3 pr-4 text-sm text-[#6B5D54]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#FFF5F7] flex items-center justify-center text-[10px] font-medium text-[#E85D70]">
                          {entry.supervisorName.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="truncate max-w-[100px]">{entry.supervisorName}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(entry.status)}
                        <span className="text-xs text-[#A8998E]">
                          {getStatusLabel(entry.status)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Compliance Panel */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        >
          <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-4">
            Compliance Status
          </h3>
          <div className="space-y-4">
            {complianceItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {item.status === 'success' && (
                    <CheckCircle2 size={18} className="text-[#7EB89A]" />
                  )}
                  {item.status === 'warning' && (
                    <AlertTriangle size={18} className="text-[#E8A838]" />
                  )}
                  {item.status === 'info' && (
                    <AlertCircle size={18} className="text-[#6BA3D6]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#4D423C]">{item.label}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-[#A8998E]">{item.value}</span>
                    <span
                      className={`text-xs font-medium ${
                        item.status === 'success'
                          ? 'text-[#7EB89A]'
                          : item.status === 'warning'
                          ? 'text-[#E8A838]'
                          : 'text-[#6BA3D6]'
                      }`}
                    >
                      {item.message}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-6 pt-6 border-t border-[#F2EDEA]">
            <p className="text-xs font-semibold text-[#A8998E] uppercase tracking-wider mb-3">
              Quick Actions
            </p>
            <div className="space-y-2">
              {quickActions.map((action) => {
                const className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FFF5F7] hover:bg-[#FFE0E6] text-[#E85D70] text-sm font-medium transition-colors duration-200";
                if ('href' in action && action.href) {
                  return (
                    <Link
                      key={action.label}
                      to={action.href}
                      className={className}
                    >
                      {action.icon}
                      {action.label}
                      <ChevronRight size={14} className="ml-auto text-[#C9BDB5]" />
                    </Link>
                  );
                }
                return (
                  <button
                    key={action.label}
                    onClick={() => action.tab && onTabChange(action.tab)}
                    className={className}
                  >
                    {action.icon}
                    {action.label}
                    <ChevronRight size={14} className="ml-auto text-[#C9BDB5]" />
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
