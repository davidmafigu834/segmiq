import {
  LayoutDashboard,
  Users,
  Phone,
  CalendarClock,
  MoreHorizontal,
} from "lucide-react";

export type TabId = "today" | "leads" | "log" | "followups" | "more";

const TABS: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard; fab?: boolean }> = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: Users },
  { id: "log", label: "Log", icon: Phone, fab: true },
  { id: "followups", label: "Follow-ups", icon: CalendarClock },
  { id: "more", label: "More", icon: MoreHorizontal },
];

type Props = {
  active: TabId;
  onChange: (tab: TabId) => void;
  followUpBadge?: number;
  syncBadge?: number;
};

export function TabBar({ active, onChange, followUpBadge = 0, syncBadge = 0 }: Props) {
  return (
    <nav
      aria-label="Bottom navigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-bg-primary"
      style={{ paddingTop: 8 }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        const badge =
          tab.id === "followups" ? followUpBadge : tab.id === "more" ? syncBadge : 0;

        if (tab.fab) {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-label="Log call"
              className="relative flex flex-1 flex-col items-center justify-end pb-2"
            >
              <span className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-accent">
                <Icon size={24} strokeWidth={2.5} />
              </span>
              <span className="mt-8 text-[10px] font-medium text-ink-tertiary">{tab.label}</span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-none transition-colors ${
              isActive ? "text-accent" : "text-ink-tertiary"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="mt-0.5 max-w-[56px] truncate text-center leading-tight">{tab.label}</span>
            {badge > 0 ? (
              <span className="absolute right-1/2 top-1.5 flex min-w-[16px] translate-x-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-accent-ink">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
