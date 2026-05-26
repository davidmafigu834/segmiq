"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronRight } from "lucide-react";
import { ShellIcon } from "./shell-icons";
import { ClientAvatar } from "@/components/ClientAvatar";
import type { AppShellClientRow, AppShellNavItem } from "./app-shell-types";

const AVATAR_TINT = [
  "bg-[#D4FF4F] text-[#0A0B0D]",
  "bg-orange-400 text-[#0A0B0D]",
  "bg-sky-400 text-[#0A0B0D]",
  "bg-rose-400 text-[#0A0B0D]",
  "bg-violet-400 text-white",
  "bg-emerald-400 text-[#0A0B0D]",
];

function clientTint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  return AVATAR_TINT[Math.abs(h) % AVATAR_TINT.length];
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function NavRow({
  item,
  navActive,
  mobileExpanded = false,
}: {
  item: AppShellNavItem;
  navActive: (href: string) => boolean;
  mobileExpanded?: boolean;
}) {
  const isActive = navActive(item.href);
  return (
    <Link
      href={item.href}
      className={`relative flex h-9 items-center gap-3 rounded-r-lg py-2 text-[13px] transition-all ${
        mobileExpanded ? "justify-start px-3" : "justify-center px-2 layout:justify-start layout:px-3"
      } ${
        isActive
          ? "border-l-2 border-[var(--ag-lime)] bg-[rgba(212,255,79,0.05)] text-[var(--ag-text-primary)] font-medium"
          : "border-l-2 border-transparent font-normal text-[var(--ag-text-tertiary)] hover:border-[rgba(212,255,79,0.3)] hover:bg-[var(--ag-surface-2)] hover:text-[var(--ag-text-secondary)]"
      } `}
    >
      <ShellIcon
        name={item.icon}
        className={`h-4 w-4 shrink-0 ${isActive ? "text-[var(--ag-lime)]" : "text-[var(--ag-text-tertiary)]"}`}
      />
      <span className={`min-w-0 flex-1 truncate ${mobileExpanded ? "inline" : "hidden layout:inline"}`}>{item.label}</span>
      {item.badge != null && item.badge > 0 ? (
        <span
          className={`rounded-[var(--radius-sm)] bg-[var(--bg-quaternary)] px-1.5 py-0 font-mono text-[10px] font-medium text-[var(--text-secondary)] border border-[var(--border)] ${
            mobileExpanded ? "inline" : "hidden layout:inline"
          }`}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AgencySidebar({
  homeHref,
  roleLabel,
  primaryNav,
  secondaryNav,
  clients,
  userName,
  userRoleLabel,
  coBrand,
  sidebarBrand,
  navActive,
  mobileExpanded = false,
}: {
  homeHref: string;
  roleLabel: string;
  primaryNav: AppShellNavItem[];
  secondaryNav: AppShellNavItem[];
  clients?: AppShellClientRow[];
  userName: string;
  userRoleLabel: string;
  coBrand?: string | null;
  sidebarBrand?: { name: string; logoUrl: string | null } | null;
  navActive: (href: string) => boolean;
  mobileExpanded?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pb-4 pt-6 layout:px-5">
        <Link
          href={homeHref}
          className={`flex items-center gap-2 ${mobileExpanded ? "justify-start" : "justify-center layout:justify-start"}`}
        >
          <span
            className={`mt-1 h-1.5 w-1.5 shrink-0 bg-[var(--accent)] ${mobileExpanded ? "hidden" : "layout:hidden"}`}
            aria-hidden
          />
          <div className={`${mobileExpanded ? "block" : "hidden layout:block"} text-left`}>
            {sidebarBrand ? (
              <div className="mb-2 flex items-center gap-2.5">
                {sidebarBrand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- client-supplied arbitrary URL
                  <img
                    src={sidebarBrand.logoUrl}
                    alt={sidebarBrand.name}
                    className="h-5 w-5 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--accent)] text-[10px] font-medium text-[var(--accent-ink)]">
                    {initialsFromName(sidebarBrand.name)}
                  </div>
                )}
                <div className="h-3 w-px shrink-0 bg-white/20" aria-hidden />
                <img src="/segmiq-wordmark.png" alt="Segmiq" className="h-5 w-auto" />
              </div>
            ) : (
              <>
                {coBrand ? (
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-[var(--text-on-dark-dim)]">
                    {coBrand}
                  </div>
                ) : null}
                <img src="/segmiq-wordmark.png" alt="Segmiq" className="h-6 w-auto" />
              </>
            )}
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-[var(--text-on-dark-dim)]">
              {roleLabel}
            </div>
          </div>
        </Link>
        <div className={`mt-5 h-px bg-[var(--surface-sidebar-border)] ${mobileExpanded ? "block" : "hidden layout:block"}`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-1 pb-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
        <nav className="flex flex-col gap-0.5 px-2 layout:px-3">
          {primaryNav.map((item) => (
            <NavRow key={item.href} item={item} navActive={navActive} mobileExpanded={mobileExpanded} />
          ))}
        </nav>

        <div
          className={`mx-2 my-2 h-px bg-[var(--surface-sidebar-border)] ${
            mobileExpanded ? "block" : "hidden layout:mx-3 layout:block"
          }`}
        />

        <nav className="flex flex-col gap-0.5 px-2 pb-2 layout:px-3">
          {secondaryNav.map((item) => (
            <NavRow key={item.href} item={item} navActive={navActive} mobileExpanded={mobileExpanded} />
          ))}
        </nav>

        {clients && clients.length > 0 ? (
          <div className={`${mobileExpanded ? "block" : "hidden layout:block"} px-3 pb-2 pt-2`}>
            <div className="mt-4 mb-2 px-2 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-[var(--text-on-dark-dim)]">
              Clients
            </div>
            <ul className="space-y-1 pr-1">
              {clients.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--text-on-dark-dim)] transition-colors hover:bg-[var(--surface-sidebar-elevated)] hover:text-[var(--text-on-dark)]"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[10px] font-medium ${clientTint(c.name)}`}
                    >
                      {c.name
                        .split(/\s+/)
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="font-mono text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-quaternary)] border border-[var(--border)] rounded-[var(--radius-sm)] px-1.5">{c.leadCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-[var(--surface-sidebar-border)] pt-4">
        <details className="group relative px-2 pb-2 layout:px-3">
          <summary
            className={`flex cursor-pointer list-none items-center gap-2 rounded-md py-2 marker:hidden hover:bg-[var(--surface-sidebar-elevated)] [&::-webkit-details-marker]:hidden ${
              mobileExpanded ? "justify-start px-2" : "justify-center px-1 layout:justify-start layout:px-2"
            }`}
          >
            <ClientAvatar name={userName} size="sm" />
            <div className={`${mobileExpanded ? "block" : "hidden layout:block"} min-w-0 flex-1 text-left`}>
              <div className="truncate text-[13px] font-medium text-[var(--text-on-dark)]">{userName}</div>
              <div className="truncate font-mono text-[11px] text-[var(--text-on-dark-dim)]">{userRoleLabel}</div>
            </div>
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-[var(--text-on-dark-dim)] transition group-open:rotate-90 ${
                mobileExpanded ? "block" : "hidden layout:block"
              }`}
            />
          </summary>
          <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-md border border-[var(--border)] bg-[var(--surface-sidebar-elevated)] py-1 shadow-[var(--shadow-md)]">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign out
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
