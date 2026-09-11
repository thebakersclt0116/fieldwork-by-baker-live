import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  label?: string;
  subLabel?: string;
  color?: string;
  subColor?: string;
}

export default function ProgressRing({
  percentage,
  size = 200,
  strokeWidth = 12,
  showPercentage = true,
  label,
  subLabel,
  subColor,
}: ProgressRingProps) {
  const [animatedPct, setAnimatedPct] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPct / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(percentage), 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Glow filter */}
        <defs>
          <linearGradient id={`ring-gradient-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F97B8A" />
            <stop offset="100%" stopColor="#E85D70" />
          </linearGradient>
          {subColor && (
            <linearGradient id={`ring-sub-gradient-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7EB89A" />
              <stop offset="100%" stopColor="#5FA37E" />
            </linearGradient>
          )}
          <filter id={`glow-${size}`}>
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F2EDEA"
          strokeWidth={strokeWidth}
        />

        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#ring-gradient-${size})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: strokeDashoffset }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
          filter={`url(#glow-${size})`}
        />

        {/* Sub-ring (e.g. unrestricted %) */}
        {subColor && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius - strokeWidth - 4}
            fill="none"
            stroke={`url(#ring-sub-gradient-${size})`}
            strokeWidth={strokeWidth / 2}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * (radius - strokeWidth - 4)}
            initial={{ strokeDashoffset: 2 * Math.PI * (radius - strokeWidth - 4) }}
            animate={{
              strokeDashoffset:
                2 * Math.PI * (radius - strokeWidth - 4) -
                (Math.min(animatedPct, 100) / 100) * 2 * Math.PI * (radius - strokeWidth - 4),
            }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], delay: 0.2 }}
          />
        )}
      </svg>

      {/* Center text */}
      {showPercentage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="font-mono text-[32px] font-medium text-[#332C28]"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {animatedPct.toFixed(1)}%
          </motion.span>
          {label && (
            <span className="text-xs font-medium text-[#A8998E] uppercase tracking-wider">
              {label}
            </span>
          )}
        </div>
      )}

      {/* Sub-label below */}
      {subLabel && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs text-[#7EB89A] font-medium">{subLabel}</span>
        </div>
      )}
    </div>
  );
}
