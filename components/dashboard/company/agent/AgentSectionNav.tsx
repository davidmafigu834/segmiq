"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui/cn";

const ITEMS = [
  { href: "/client/agent", label: "Activity", match: (p: string) => p === "/client/agent" },
  {
    href: "/client/agent/learning",
    label: "Learning",
    match: (p: string) => p.startsWith("/client/agent/learning"),
  },
  {
    href: "/client/settings/automation/agent",
    label: "Settings",
    match: (p: string) => p.startsWith("/client/settings/automation/agent"),
  },
];

export function AgentSectionNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-sales-border-subtle pb-px">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-[8px] px-3 py-1.5 text-[12px] font-medium",
              active
                ? "bg-sales-surface text-sales-text-primary"
                : "text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
