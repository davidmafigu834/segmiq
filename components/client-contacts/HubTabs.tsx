"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/client/leads", label: "Leads" },
  { href: "/client/customers", label: "Customers" },
  { href: "/client/contacts", label: "Contacts" },
];

export function HubTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex items-center gap-1 border-b border-[var(--border)]">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative px-3.5 py-2.5 text-sm font-medium ${
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
