"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/client/marketing", label: "Overview", exact: true },
  { href: "/client/marketing/campaigns", label: "Campaigns" },
  { href: "/client/marketing/journeys", label: "Journeys" },
  { href: "/client/marketing/templates", label: "Templates" },
  { href: "/client/marketing/reports", label: "Reports" },
  { href: "/client/marketing/audiences", label: "Audiences" },
  { href: "/client/marketing/preferences", label: "Communication Preferences" },
  { href: "/client/marketing/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MarketingHubTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-[var(--border)]">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href, "exact" in t ? t.exact : false);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative shrink-0 px-3.5 py-2.5 text-sm font-medium ${
              active
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
            {active && (
              <span className="absolute -bottom-px left-3.5 right-3.5 h-0.5 rounded bg-[var(--accent)]" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
