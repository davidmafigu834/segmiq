"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClientAvatar } from "@/components/ClientAvatar";
import { PublicSlugCopy } from "@/components/clients/PublicSlugCopy";
import { AgencyManagedToggle } from "@/components/clients/AgencyManagedToggle";
import { PlatformStatusBadge } from "@/components/platform/PlatformStatusBadge";
import { Fact } from "@/components/platform/workbench";
import type { ClientDetailHeroProps } from "@/lib/client-hero";

type Tab = { label: string; href: string; exact?: boolean };

function tabs(id: string): { name: string; items: Tab[] }[] {
  const base = `/dashboard/clients/${id}`;
  return [
    {
      name: "Work",
      items: [
        { label: "Overview", href: base, exact: true },
        { label: "Users", href: `${base}/team` },
        { label: "Projects", href: `${base}/projects` },
        { label: "Campaigns", href: `${base}/campaigns` },
      ],
    },
    {
      name: "Setup",
      items: [
        { label: "Integrations", href: `${base}/facebook` },
        { label: "Settings", href: `${base}/settings` },
        { label: "Profile page", href: `${base}/profile` },
        { label: "Testimonials", href: `${base}/testimonials` },
        { label: "Form", href: `${base}/form` },
        { label: "Instant forms", href: `${base}/instant-forms` },
        { label: "Audiences", href: `${base}/audiences` },
      ],
    },
  ];
}

function tabOn(pathname: string, tab: Tab) {
  return tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

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
  const groups = tabs(clientId);
  const overview = pathname === `/dashboard/clients/${clientId}`;
  const activeLabel = groups.flatMap((group) => group.items).find((tab) => tabOn(pathname, tab))?.label ?? "this section";
  const facebookLinked = Boolean(hero.fbFormId || hero.fbPageId);
  const suspended = statusLabel === "suspended";
  const tokenExpired = Boolean(hero.fbTokenExpiredAt);
  const exception = suspended
    ? { text: "This organisation is suspended.", href: `/dashboard/clients/${clientId}/settings`, action: "Open settings" }
    : tokenExpired
      ? { text: "The Facebook token has expired.", href: `/dashboard/clients/${clientId}/facebook`, action: "Reconnect" }
      : null;

  return (
    <div>
      <header className="flex flex-col gap-5 layout:flex-row layout:items-start layout:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <ClientAvatar name={name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] sm:text-[24px]">
                {name}
              </h1>
              <PlatformStatusBadge
                kind={suspended ? "suspended" : "active"}
                label={statusLabel ? titleCase(statusLabel) : "Active"}
              />
            </div>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
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
            ok={facebookLinked && !tokenExpired}
            okText="Connected"
            offText={tokenExpired ? "Token expired" : "Not connected"}
            warn={tokenExpired}
          />
        </div>
      </header>

      {exception ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] text-[var(--text-tertiary)]">Needs a decision</p>
            <p className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">{exception.text}</p>
          </div>
          <Link
            href={exception.href}
            className="inline-flex h-9 shrink-0 items-center rounded-md bg-[var(--text-primary)] px-3 text-[13px] font-semibold text-[var(--bg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {exception.action}
          </Link>
        </div>
      ) : null}

      <nav aria-label="Organisation sections" className="mt-6 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-secondary)]">
        {groups.map((group, index) => (
          <div
            key={group.name}
            role="list"
            aria-label={group.name}
            className={`flex gap-1 overflow-x-auto px-2 py-2 ${index > 0 ? "border-t border-[var(--border)]" : ""}`}
          >
            {group.items.map((tab) => {
              const active = tabOn(pathname, tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  role="listitem"
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                    active
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-6">
        {overview || exception ? (
          children
        ) : (
          <div className="space-y-8">
            <Fact
              name={activeLabel === "Users" ? "View as a person only when you mean to enter their CRM." : `This is ${activeLabel}.`}
              detail={activeLabel === "Users" ? "The session is audited. The list below is the team." : "Finish the record here. Overview is where the next decision is named."}
              action="Back to overview"
              href={`/dashboard/clients/${clientId}`}
            />
            {children}
          </div>
        )}
      </div>
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
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span className={warn ? "text-[var(--warning)]" : "text-[var(--text-primary)]"}>{ok && !warn ? okText : offText}</span>
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}
