import { motion } from 'framer-motion';

interface StatCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  badge?: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  progress?: number;
  icon: React.ReactNode;
  delay?: number;
}

export default function StatCard({
  value,
  label,
  sublabel,
  badge,
  trend,
  trendPositive = true,
  progress,
  icon,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl bg-[#FFF5F7] text-[#E85D70]">{icon}</div>
        {badge && <div>{badge}</div>}
      </div>

      <div className="mb-1">
        <span className="font-mono text-[32px] font-medium text-[#332C28] leading-none">
          {value}
        </span>
      </div>

      <p className="text-sm text-[#A8998E] mb-2">{label}</p>

      {sublabel && <p className="text-xs text-[#C9BDB5] mb-3">{sublabel}</p>}

      {progress !== undefined && (
        <div className="mb-3">
          <div className="w-full h-2 bg-[#F2EDEA] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(135deg, #F97B8A 0%, #E85D70 100%)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 1, delay: delay + 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            />
          </div>
        </div>
      )}

      {trend && (
        <span
          className={`text-xs font-medium ${trendPositive ? 'text-[#7EB89A]' : 'text-[#E8A838]'}`}
        >
          {trend}
        </span>
      )}
    </motion.div>
  );
}
