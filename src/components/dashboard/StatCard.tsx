import React from 'react';
import { LucideIcon, TrendingUp } from 'lucide-react';

export type StatCardColor = 'peach' | 'mint' | 'sky' | 'lavender' | 'yellow';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  subtext?: string;
  color?: StatCardColor;
}

const COLOR_THEMES: Record<
  StatCardColor,
  {
    bg: string;
    icon: string;
    label: string;
  }
> = {
  peach: {
    bg: 'bg-[#FFEFE6]', // Soft Warm Peach
    icon: 'text-[#FF8A3D]',
    label: 'text-amber-950/60',
  },
  mint: {
    bg: 'bg-[#E8F8EE]', // Soft Fresh Mint
    icon: 'text-[#10B981]',
    label: 'text-emerald-950/60',
  },
  sky: {
    bg: 'bg-[#EBF3FE]', // Soft Sky Blue
    icon: 'text-[#3B82F6]',
    label: 'text-blue-950/60',
  },
  lavender: {
    bg: 'bg-[#F1EBFE]', // Soft Lavender
    icon: 'text-[#8B5CF6]',
    label: 'text-purple-950/60',
  },
  yellow: {
    bg: 'bg-[#FEF6E4]', // Soft Butter Yellow
    icon: 'text-[#F59E0B]',
    label: 'text-amber-950/60',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  trend,
  subtext,
  color = 'peach',
}) => {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.peach;

  return (
    <div
      className={`${theme.bg} rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-transform hover:-translate-y-0.5`}
    >
      <div>
        <span
          className={`text-xs font-black font-display tracking-wider uppercase ${theme.label}`}
        >
          {label}
        </span>
      </div>

      <div className="flex items-end justify-between gap-4 mt-5">
        <div>
          <div className="text-3xl sm:text-4xl font-black font-display text-[#0D0D11] tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {trend && (
            <div className="flex items-center gap-2 mt-2.5 text-xs font-bold text-zinc-500">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold bg-white/80 px-2.5 py-0.5 rounded-full text-[11px] shadow-xs">
                <TrendingUp className="w-3 h-3" />
                {trend}
              </span>
              {subtext && <span className="font-semibold text-[11px] text-zinc-500">{subtext}</span>}
            </div>
          )}
        </div>

        <Icon
          className={`w-13 h-13 sm:w-14 sm:h-14 ${theme.icon} shrink-0`}
          strokeWidth={1.8}
        />
      </div>
    </div>
  );
};

