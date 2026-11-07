"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { agentWorkspaceShortcuts, managerWorkspaceShortcuts } from "@/lib/real-estate/workspace-links";

/** Short row of existing routes for the current Real Estate destination. */
export function RealEstateWorkspaceLinks({ scope }: { scope: "agent" | "manager" }) {
  const pathname = usePathname() ?? "";
  const links = scope === "agent" ? agentWorkspaceShortcuts(pathname) : managerWorkspaceShortcuts(pathname);
  if (links.length === 0) return null;

  return (
    <nav aria-label="Related" className="shrink-0">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {links.map((link) => (
          <li key={link.href} className="shrink-0">
            <Link
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] font-medium text-sales-text-primary hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
