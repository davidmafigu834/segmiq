"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/client/leads", label: "Overview", exact: true },
  { href: "/client/leads/pipeline", label: "Pipeline" },
  { href: "/client/contacts", label: "All contacts" },
  { href: "/client/customers", label: "Customers" },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (href === "/client/contacts") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HubTabs() {
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
