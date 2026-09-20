"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ClientAvatar } from "@/components/ClientAvatar";
import { PublicSlugCopy } from "@/components/clients/PublicSlugCopy";
import { AgencyManagedToggle } from "@/components/clients/AgencyManagedToggle";
import { PlatformStatusBadge } from "@/components/platform/PlatformStatusBadge";
import type { ClientDetailHeroProps } from "@/lib/client-hero";

const PRIMARY_TABS = (id: string) =>
  [
    { label: "Overview", href: `/dashboard/clients/${id}` },
    { label: "Users", href: `/dashboard/clients/${id}/team` },
    { label: "Integrations", href: `/dashboard/clients/${id}/facebook` },
    { label: "Settings", href: `/dashboard/clients/${id}/settings` },
  ] as const;

const MORE_TABS = (id: string) =>
  [
    { label: "Projects", href: `/dashboard/clients/${id}/projects` },
    { label: "Profile page", href: `/dashboard/clients/${id}/profile` },
    { label: "Testimonials", href: `/dashboard/clients/${id}/testimonials` },
    { label: "Form", href: `/dashboard/clients/${id}/form` },
    { label: "Instant forms", href: `/dashboard/clients/${id}/instant-forms` },
    { label: "Campaigns", href: `/dashboard/clients/${id}/campaigns` },
    { label: "Audiences", href: `/dashboard/clients/${id}/audiences` },
  ] as const;

export function ClientDetailView({
  clientId,
  name,
  industry,
  publicProfileUrl,
  hero,
  agencyManaged = true,
  children,
  organisationId,
  statusLabel,
  planLabel,
}: {
  clientId: string;
  name: string;
  industry: string;
  publicProfileUrl: string | null;
  hero: ClientDetailHeroProps;
  agencyManaged?: boolean;
  children: React.ReactNode;
  organisationId?: string;
  statusLabel?: string;
  planLabel?: string;
}) {
  const pathname = usePathname();
  const primary = PRIMARY_TABS(clientId);
  const more = MORE_TABS(clientId);
  const activeTabRef = useRef<HTMLAnchorElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const moreActive = more.some((t) => pathname === t.href);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  const facebookLinked = Boolean(hero.fbFormId || hero.fbPageId);

  return (
    <div>
      <p className="mb-4 text-[12px] text-[var(--text-tertiary)]">
        <Link href="/dashboard/clients" className="hover:text-[var(--text-primary)]">
          Organisations
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[var(--text-secondary)]">{name}</span>
      </p>

      <header className="mb-6 flex flex-col gap-5 layout:flex-row layout:items-start layout:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <ClientAvatar name={name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] sm:text-[24px]">
                {name}
              </h1>
              <PlatformStatusBadge
                kind={statusLabel === "suspended" ? "suspended" : "active"}
                label={statusLabel ? titleCase(statusLabel) : "Active"}
              />
            </div>
            <p className="mt-1 font-mono text-[11px] text-[var(--text-tertiary)]">
              {organisationId ?? clientId}
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              {planLabel ? `${planLabel} · ` : ""}
              {industry || "No industry set"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <AgencyManagedToggle clientId={clientId} agencyManaged={agencyManaged} />
              {publicProfileUrl ? <PublicSlugCopy url={publicProfileUrl} /> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5 text-[12px] layout:items-end">
          <HealthLine
            label="Profile"
            ok={hero.profilePublished}
            okText="Live"
            offText="Not published"
          />
          <HealthLine
            label="Facebook"
            ok={facebookLinked && !hero.fbTokenExpiredAt}
            okText="Connected"
            offText={hero.fbTokenExpiredAt ? "Token expired" : "Not connected"}
            warn={Boolean(hero.fbTokenExpiredAt)}
          />
        </div>
      </header>

      <nav className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] scrollbar-hide">
        {primary.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              ref={active ? activeTabRef : undefined}
              className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors ${
                active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t.label}
              {active ? (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent)]" />
              ) : null}
            </Link>
          );
        })}
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`relative inline-flex items-center gap-1 px-3 py-2.5 text-[13px] font-medium ${
              moreActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            aria-expanded={moreOpen}
          >
            More
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
            {moreActive ? <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent)]" /> : null}
          </button>
          {moreOpen ? (
            <div className="absolute left-0 z-20 mt-1 w-48 rounded-md border border-[var(--border)] bg-[var(--surface-dropdown)] py-1 shadow-[var(--shadow-md)]">
              {more.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={() => setMoreOpen(false)}
                  className={`block px-3 py-1.5 text-[13px] ${
                    pathname === t.href
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}

function HealthLine({
  label,
  ok,
  okText,
  offText,
  warn,
}: {
  label: string;
  ok: boolean;
  okText: string;
  offText: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          warn ? "bg-[var(--warning)]" : ok ? "bg-[var(--success)]" : "bg-[var(--text-tertiary)]"
        }`}
        aria-hidden
      />
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[var(--text-primary)]">{ok && !warn ? okText : offText}</span>
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}
