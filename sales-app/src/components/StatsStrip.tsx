import { Phone, CalendarClock, Activity, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardData } from "../lib/types";

type StatTone = "accent" | "warning" | "success";

type Stat = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: StatTone;
  onSelect?: () => void;
};

const TONE_COLOR: Record<StatTone, string> = {
  accent: "var(--accent)",
  warning: "var(--warning)",
  success: "var(--success)",
};

type Props = {
  numbers: DashboardData["numbers"];
  onSelectCallNow?: () => void;
  onSelectFollowUps?: () => void;
};

export function StatsStrip({ numbers, onSelectCallNow, onSelectFollowUps }: Props) {
  const stats: Stat[] = [
    {
      label: "Call now",
      value: numbers.callNow ?? 0,
      icon: Phone,
      tone: "accent",
      onSelect: onSelectCallNow,
    },
    {
      label: "Follow-ups due",
      value: numbers.followUpToday ?? 0,
      icon: CalendarClock,
      tone: "warning",
      onSelect: onSelectFollowUps,
    },
    {
      label: "Logged today",
      value: numbers.calledToday ?? 0,
      icon: Activity,
      tone: "success",
    },
    {
      label: "Won this month",
      value: numbers.wonThisMonth ?? 0,
      icon: Trophy,
      tone: "accent",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const active = stat.value > 0;
        const color = active ? TONE_COLOR[stat.tone] : "var(--text-disabled)";
        const Tag = stat.onSelect ? "button" : "div";
        return (
          <Tag
            key={stat.label}
            type={stat.onSelect ? "button" : undefined}
            onClick={stat.onSelect}
            className={`flex items-center gap-3 rounded-xl border border-border bg-surface-card px-3 py-3 text-left transition-colors ${
              stat.onSelect ? "active:bg-bg-tertiary" : ""
            }`}
          >
            <Icon size={16} className="shrink-0" style={{ color }} />
            <div className="min-w-0">
              <p
                className="font-display text-[22px] font-semibold leading-none"
                style={{ color }}
              >
                {stat.value}
              </p>
              <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">
                {stat.label}
              </p>
            </div>
          </Tag>
        );
      })}
    </div>
  );
}
