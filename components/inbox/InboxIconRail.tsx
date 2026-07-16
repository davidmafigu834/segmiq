"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Inbox,
  Settings,
  Users,
} from "lucide-react";

type RailItem = {
  href: string;
  label: string;
  icon: typeof Inbox;
  active?: boolean;
};

type Props = {
  pipelineHref: string;
  teamHref?: string;
  settingsHref: string;
  inboxHref: string;
};

export function InboxIconRail({ pipelineHref, teamHref, settingsHref, inboxHref }: Props) {
  const pathname = usePathname();

  const items: RailItem[] = [
    { href: inboxHref, label: "Inbox", icon: Inbox, active: pathname.includes("/inbox") },
    { href: pipelineHref, label: "Pipeline", icon: BarChart3 },
    ...(teamHref ? [{ href: teamHref, label: "Team", icon: Users }] : []),
    { href: settingsHref, label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-[var(--border)] bg-[var(--surface-sidebar)] py-4">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.active ?? (pathname === item.href || pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition-all ${
              isActive
                ? "border border-[var(--border)] bg-[var(--surface-card)] text-[var(--accent-fg)]"
                : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Icon size={18} strokeWidth={2} />
          </Link>
        );
      })}
    </div>
  );
}
