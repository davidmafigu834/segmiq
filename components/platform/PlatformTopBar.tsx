"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, LayoutDashboard, Menu, Plus, Receipt, Shield } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { CreateClientModal } from "@/components/dashboard/CreateClientModal";
import { PlatformClientSwitcher, type PlatformClientOption } from "@/components/platform/PlatformClientSwitcher";
import { PlatformStatusIndicator } from "@/components/platform/PlatformStatusIndicator";
import type { UserRole } from "@/types";
import "@/components/real-estate/navigation/real-estate-sidebar.css";

const DOCK = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Organisations", icon: Building2 },
  { href: "/dashboard/commercial", label: "Commercial", icon: Receipt },
  { href: "/dashboard/billing", label: "Billing", icon: FileText },
];

const STARTS = [
  { label: "Organisation", create: true, href: "" },
  { label: "Prospect", create: false, href: "/dashboard/commercial-sales" },
  { label: "Incident", create: false, href: "/dashboard/status-incidents" },
];

export function PlatformPageHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="pc-head">
      {kicker ? <p className="pc-kicker">{kicker}</p> : null}
      <h1 className="pc-title">{title}</h1>
    </div>
  );
}

export function PlatformTopBar({
  clients,
  onOpenMenu,
  actions,
  unread,
  notificationRole,
}: {
  clients: PlatformClientOption[];
  onOpenMenu: () => void;
  actions?: React.ReactNode;
  unread: number;
  notificationRole: UserRole;
}) {
  const pathname = usePathname() ?? "";
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const createId = useId();
  const supportOn = pathname === "/dashboard/support-access" || pathname.startsWith("/dashboard/support-access/");

  useEffect(() => {
    if (!createOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setCreateOpen(false);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-create-menu]")) return;
      setCreateOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [createOpen]);

  return (
    <header className="re-top safe-top shrink-0">
      <button type="button" className="re-top-mark layout:hidden" aria-label="Open menu" onClick={onOpenMenu}>
        <Menu size={18} strokeWidth={1.8} aria-hidden />
      </button>
      <PlatformClientSwitcher clients={clients} />
      <span className="re-top-gap" />
      <div className="pc-create" data-create-menu="">
        <button
          type="button"
          className="re-top-btn"
          aria-expanded={createOpen}
          aria-controls={createId}
          onClick={() => setCreateOpen((open) => !open)}
        >
          <Plus size={15} strokeWidth={2} aria-hidden />
          <span className="pc-create-label">Create new</span>
        </button>
        {createOpen ? (
          <div id={createId} role="dialog" aria-label="Create" className="re-sb-pop re-top-pop re-top-pop-end">
            {STARTS.map((item) =>
              item.create ? (
                <button
                  key={item.label}
                  type="button"
                  className="re-sb-menu-row"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreating(true);
                  }}
                >
                  <span className="re-sb-label">{item.label}</span>
                </button>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="re-sb-menu-row"
                  onClick={() => setCreateOpen(false)}
                >
                  <span className="re-sb-label">{item.label}</span>
                </Link>
              )
            )}
          </div>
        ) : null}
      </div>
      <Link href="/dashboard/support-access" className="re-top-btn pc-support" aria-current={supportOn ? "page" : undefined}>
        <Shield size={15} strokeWidth={2} aria-hidden />
        <span className="pc-support-label">Support access</span>
      </Link>
      <div className="re-top-status hidden sm:block">
        <PlatformStatusIndicator />
      </div>
      <GlobalSearch role={notificationRole} appearance="icon" placeholder="Search organisations, users, IDs..." />
      <div className="pc-bell layout:hidden">
        <NotificationBell initialUnread={unread} role={notificationRole} />
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      <CreateClientModal open={creating} onClose={() => setCreating(false)} />
    </header>
  );
}

export function PlatformDock({
  isActive,
  onMore,
}: {
  isActive: (href: string) => boolean;
  onMore: () => void;
}) {
  return (
    <nav className="pc-dock safe-bottom" aria-label="Platform">
      {DOCK.map((item) => {
        const Icon = item.icon;
        const current = isActive(item.href);
        return (
          <Link key={item.href} href={item.href} className="pc-dock-item" aria-current={current ? "page" : undefined}>
            <Icon size={20} strokeWidth={1.75} aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button type="button" className="pc-dock-item" onClick={onMore}>
        <Menu size={20} strokeWidth={1.75} aria-hidden />
        <span>More</span>
      </button>
    </nav>
  );
}
