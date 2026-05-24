"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Plus, X } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import type { UserRole } from "@/types";
import { NewLeadModal } from "@/components/agency/NewLeadModal";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { AgencySidebar } from "./AgencySidebar";
import { AgencyHeaderClock } from "./AgencyHeaderClock";
import { ShellIcon } from "./shell-icons";
import type { AppShellClientRow, AppShellNavItem } from "./app-shell-types";

export type { AppShellClientRow, AppShellNavItem } from "./app-shell-types";

export function AppShell({
  homeHref,
  roleLabel,
  primaryNav,
  secondaryNav,
  clients,
  userName,
  userRoleLabel,
  breadcrumb,
  pageTitle,
  actions,
  children,
  unreadNotifications,
  notificationRole,
  coBrand,
  sidebarBrand,
  quickActionHref = "/dashboard/leads",
  showQuickAction = true,
  showWorkspaceSearch = true,
  hideHeader = false,
  titleSize = "standard",
}: {
  homeHref: string;
  roleLabel: string;
  primaryNav: AppShellNavItem[];
  secondaryNav: AppShellNavItem[];
  clients?: AppShellClientRow[];
  userName: string;
  userRoleLabel: string;
  breadcrumb: string;
  pageTitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  unreadNotifications?: number;
  notificationRole: UserRole;
  coBrand?: string | null;
  sidebarBrand?: { name: string; logoUrl: string | null } | null;
  quickActionHref?: string;
  showQuickAction?: boolean;
  showWorkspaceSearch?: boolean;
  hideHeader?: boolean;
  titleSize?: "hero" | "standard";
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  function navActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/client/dashboard") return pathname === "/client/dashboard";
    if (href === "/sales/leads") return pathname === "/sales/leads";
    if (href === "/sales/won-lost") return pathname === "/sales/won-lost";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const hideQuick = showQuickAction === false || notificationRole === "CLIENT_MANAGER";
  const hideSearch = showWorkspaceSearch === false;

  const sidebar = (
    <AgencySidebar
      homeHref={homeHref}
      roleLabel={roleLabel}
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      clients={clients}
      userName={userName}
      userRoleLabel={userRoleLabel}
      coBrand={coBrand}
      sidebarBrand={sidebarBrand}
      navActive={navActive}
    />
  );
  const mobileSidebar = (
    <AgencySidebar
      homeHref={homeHref}
      roleLabel={roleLabel}
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      clients={clients}
      userName={userName}
      userRoleLabel={userRoleLabel}
      coBrand={coBrand}
      sidebarBrand={sidebarBrand}
      navActive={navActive}
      mobileExpanded
    />
  );

  return (
    <div className="flex min-h-screen min-h-[100svh] bg-bg-primary layout:h-[100dvh] layout:max-h-[100dvh] layout:min-h-0 layout:overflow-hidden">
      <aside
        className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-[var(--border)] bg-surface-sidebar layout:flex"
        aria-label="Workspace navigation"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{sidebar}</div>
      </aside>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm layout:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-[51] flex w-[85vw] max-w-[320px] flex-col overflow-y-auto border-r border-[var(--border)] bg-surface-sidebar layout:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] p-4">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">Menu</span>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{mobileSidebar}</div>
          </aside>
        </>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col layout:ml-60 layout:min-h-0 layout:overflow-hidden">
        {hideHeader ? (
          <header className="safe-top sticky top-0 z-30 flex flex-col gap-2 border-b border-[var(--border)] bg-bg-primary px-4 py-2.5 layout:hidden">
            <div className="flex min-h-11 shrink-0 items-center gap-2">
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <div className="min-w-0 flex-1" />
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <NotificationBell initialUnread={unreadNotifications ?? 0} role={notificationRole} />
                {!hideQuick ? (
                  notificationRole === "AGENCY_ADMIN" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setNewLeadOpen(true)}
                        className="btn-primary flex h-9 w-9 items-center justify-center"
                        aria-label="New lead"
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                      <NewLeadModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} clients={clients ?? []} />
                    </>
                  ) : (
                    <Link
                      href={quickActionHref}
                      className="btn-primary flex h-9 w-9 items-center justify-center"
                      aria-label="New lead"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                    </Link>
                  )
                ) : null}
                {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
              </div>
            </div>
            {!hideSearch ? (
              <div className="min-w-0 w-full border-t border-[var(--border)] pt-2">
                <GlobalSearch role={notificationRole} />
              </div>
            ) : null}
          </header>
        ) : (
          <header className="safe-top sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-bg-primary px-4 md:px-6 layout:px-10">
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] layout:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
              <span className="hidden md:inline shrink-0 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                {breadcrumb}
              </span>
              <span className="hidden md:inline shrink-0 text-[10px] text-[var(--text-tertiary)] opacity-50">·</span>
              <h1 className={`min-w-0 truncate font-semibold leading-none text-[var(--text-primary)] ${titleSize === "hero" ? "text-[15px] md:text-[18px] layout:text-[22px]" : "text-[14px] md:text-[16px] layout:text-[20px]"}`}>{pageTitle}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center lg:flex">
                <AgencyHeaderClock />
              </div>
              {!hideSearch ? <GlobalSearch role={notificationRole} /> : null}
              <NotificationBell initialUnread={unreadNotifications ?? 0} role={notificationRole} />
              {!hideQuick ? (
                notificationRole === "AGENCY_ADMIN" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setNewLeadOpen(true)}
                      className="btn-primary hidden h-9 items-center gap-2 px-3.5 text-[13px] font-medium md:inline-flex"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                      New lead
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewLeadOpen(true)}
                      className="btn-primary flex h-9 w-9 items-center justify-center md:hidden"
                      aria-label="New lead"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <NewLeadModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} clients={clients ?? []} />
                  </>
                ) : (
                  <>
                    <Link
                      href={quickActionHref}
                      className="btn-primary hidden h-9 items-center gap-2 px-3.5 text-[13px] font-medium md:inline-flex"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                      + New lead
                    </Link>
                    <Link
                      href={quickActionHref}
                      className="btn-primary flex h-9 w-9 items-center justify-center md:hidden"
                      aria-label="New lead"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                    </Link>
                  </>
                )
              ) : null}
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
          </header>
        )}

        <main style={{ overflowX: "clip" }} className="flex-1 px-4 pt-6 pb-28 md:px-6 md:pt-8 layout:pb-10 layout:min-h-0 layout:overflow-y-auto layout:overscroll-contain layout:px-8 layout:pt-8">
          {children}
        </main>
      </div>

      <nav
        aria-label="Bottom navigation"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--border)] bg-bg-primary layout:hidden"
      >
        {primaryNav.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-none transition-colors ${
              navActive(item.href)
                ? "text-accent"
                : "text-[var(--text-tertiary)]"
            }`}
          >
            <ShellIcon name={item.icon} className="h-5 w-5 shrink-0" />
            <span className="mt-0.5 max-w-[56px] truncate text-center leading-tight">{item.label}</span>
            {item.badge != null && item.badge > 0 ? (
              <span className="absolute right-1/2 top-1.5 flex min-w-[16px] translate-x-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-accent-ink">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
