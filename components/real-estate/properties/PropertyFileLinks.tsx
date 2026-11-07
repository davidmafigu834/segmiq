"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type FilePayload = {
  title: string;
  stageLabel: string;
  personLabel: string | null;
  nextAction: string;
  href: string;
  historyHref: string | null;
  listingHref: string | null;
  links: Array<{ label: string; href: string }>;
};

export function PropertyFileLinks({
  clientId,
  surface,
  listingId,
  opportunityId,
  onListingHref,
}: {
  clientId: string;
  surface: "sales" | "client";
  listingId?: string | null;
  opportunityId?: string | null;
  onListingHref?: (href: string | null) => void;
}) {
  const [file, setFile] = useState<FilePayload | null>(null);
  const [failed, setFailed] = useState(false);
  const hrefListener = useRef(onListingHref);
  hrefListener.current = onListingHref;

  const load = useCallback(async () => {
    setFailed(false);
    const params = new URLSearchParams({ surface });
    if (listingId) params.set("listingId", listingId);
    if (opportunityId) params.set("opportunityId", opportunityId);
    try {
      const res = await fetch(`/api/clients/${clientId}/properties/file?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setFailed(true);
        setFile(null);
        hrefListener.current?.(null);
        return;
      }
      const json = (await res.json()) as FilePayload;
      setFile(json);
      hrefListener.current?.(json.listingHref);
    } catch {
      setFailed(true);
      setFile(null);
      hrefListener.current?.(null);
    }
  }, [clientId, surface, listingId, opportunityId]);

  useEffect(() => { void load(); }, [load]);

  if (failed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2">
        <p className="text-[13px] text-sales-text-secondary">Related property work could not be loaded.</p>
        <button type="button" className="min-h-11 text-[13px] font-semibold underline" onClick={() => void load()}>Retry</button>
      </div>
    );
  }
  if (!file) return null;

  const links = file.links.filter((link) => link.href !== file.href && link.href !== file.historyHref && link.href !== file.listingHref);
  return (
    <section className="space-y-2 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-3" aria-label="Property file">
      <p className="text-[13px] text-sales-text-secondary">
        {[file.stageLabel, file.personLabel, file.nextAction].filter(Boolean).join(" · ")}
      </p>
      <ul className="flex flex-wrap gap-2">
        {file.listingHref && file.listingHref !== file.href ? (
          <li>
            <Link href={file.listingHref} className="inline-flex min-h-11 items-center rounded-[10px] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
              Open listing
            </Link>
          </li>
        ) : null}
        {file.historyHref && file.historyHref !== file.href ? (
          <li>
            <Link href={file.historyHref} className="inline-flex min-h-11 items-center rounded-[10px] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
              Seller opportunity
            </Link>
          </li>
        ) : null}
        {links.map((link) => (
          <li key={`${link.label}:${link.href}`}>
            <Link href={link.href} className="inline-flex min-h-11 items-center rounded-[10px] border border-sales-border px-3 text-[13px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
