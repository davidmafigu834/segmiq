import Link from "next/link";
import type { WorkspaceShortcut } from "@/lib/real-estate/workspace-links";

export function RealEstateLinkDirectory({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: Array<WorkspaceShortcut & { count?: string | null }>;
}) {
  return (
    <section className="space-y-3">
      <header>
        <h1 className="font-display text-[24px] font-semibold leading-none tracking-[-0.02em] text-sales-text-primary">{title}</h1>
        <p className="mt-1 text-[13px] leading-snug text-sales-text-secondary">{description}</p>
      </header>
      <ul className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        {links.map((link) => (
          <li key={link.href} className="border-b border-sales-border-subtle last:border-b-0">
            <Link
              href={link.href}
              className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium text-sales-text-primary hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
            >
              <span>{link.label}</span>
              {link.count ? <span className="text-[12px] font-medium text-sales-text-secondary">{link.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
