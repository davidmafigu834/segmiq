"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Grid, Folder, Camera, Users, Settings, LayoutGrid, LogOut, CloudUpload,
  Bell, CreditCard, HelpCircle, BarChart2, Tag, ChevronDown, ChevronRight,
} from "lucide-react";
import { Suspense } from "react";
import { matchesCloudDashboardPath, normalizeCloudDashboardPath } from "./cloud-path";
import { isCloudAdminRole } from "@/lib/auth/roles";

const CLOUD_ADMIN_PATH_SUFFIXES = ["/settings", "/team", "/billing", "/pricing", "/analytics", "/onboarding"];

const WORKSPACE_NAV = [
  { href: "/cloud/dashboard", icon: Grid, label: "Home" },
  { href: "/cloud/dashboard/projects", icon: Folder, label: "Projects" },
  { href: "/cloud/dashboard/upload", icon: Camera, label: "Upload" },
];

const BUSINESS_NAV = [
  { href: "/cloud/dashboard/pricing", icon: Tag, label: "Pricing" },
  { href: "/cloud/dashboard/team", icon: Users, label: "Team" },
];

const ACCOUNT_NAV = [
  { href: "/cloud/dashboard/notifications", icon: Bell, label: "Notifications", badge: "notifications" as const },
  { href: "/cloud/dashboard/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/cloud/dashboard/billing", icon: CreditCard, label: "Billing" },
  { href: "/cloud/dashboard/settings", icon: Settings, label: "Settings" },
  { href: "/cloud/help", icon: HelpCircle, label: "Help" },
];

const MOBILE_NAV = [
  { href: "/cloud/dashboard", icon: Grid, label: "Home" },
  { href: "/cloud/dashboard/projects", icon: Folder, label: "Projects" },
  { href: "/cloud/dashboard/upload", icon: Camera, label: "Upload" },
  { href: "/cloud/dashboard/notifications", icon: Bell, label: "Alerts" },
  { href: "/cloud/dashboard/more", icon: LayoutGrid, label: "More" },
];

function isActive(href: string, pathname: string) {
  const normalized = normalizeCloudDashboardPath(pathname);
  if (href === "/cloud/dashboard") return normalized === href;
  return normalized.startsWith(href);
}

function getPageTitle(pathname: string): string | null {
  const p = normalizeCloudDashboardPath(pathname);
  if (/^\/cloud\/dashboard\/projects\/[^/]+\/analytics\/?$/.test(p)) return "Analytics";
  if (/^\/cloud\/dashboard\/projects\/[^/]+\/?$/.test(p)) return null;
  if (p.startsWith("/cloud/dashboard/projects")) return "Projects";
  if (p.startsWith("/cloud/dashboard/pricing")) return "Pricing";
  if (p.startsWith("/cloud/dashboard/upload/desktop")) return "Bulk upload";
  if (p.startsWith("/cloud/dashboard/upload")) return "Upload";
  if (p.startsWith("/cloud/dashboard/team")) return "Team";
  if (p.startsWith("/cloud/dashboard/settings")) return "Settings";
  if (p.startsWith("/cloud/dashboard/notifications")) return "Notifications";
  if (p.startsWith("/cloud/dashboard/analytics")) return "Analytics";
  if (p.startsWith("/cloud/dashboard/billing")) return "Billing";
  if (p.startsWith("/cloud/dashboard/more")) return "More";
  if (p.startsWith("/cloud/dashboard/onboarding")) return "Setup";
  return null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "ME";
}

function roleLabel(role: string | undefined): string {
  if (role === "CLIENT_MANAGER") return "Manager";
  if (role === "SALESPERSON") return "Salesperson";
  if (role === "AGENCY_ADMIN") return "Admin";
  return role?.replace(/_/g, " ").toLowerCase() ?? "";
}

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: "notifications";
};

function SidebarNavLink({
  href,
  icon: Icon,
  label,
  pathname,
  badge,
  unreadCount,
}: NavItem & { pathname: string; unreadCount: number }) {
  const active = isActive(href, pathname);
  return (
    <Link
      href={href}
      className={`cloud-nav-link ${active ? "cloud-nav-link--active" : ""}`}
    >
      <div className="relative shrink-0">
        <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.2 : 1.75} />
        {badge === "notifications" && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--cloud-ink)] px-1 text-[9px] font-bold text-[var(--cloud-accent)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </div>
      {label}
    </Link>
  );
}

function NavSection({
  title,
  items,
  pathname,
  unreadCount,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  unreadCount: number;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="cloud-nav-section-label">{title}</p>
      <div className="px-2">
        {items.map((item) => (
          <SidebarNavLink key={item.href} {...item} pathname={pathname} unreadCount={unreadCount} />
        ))}
      </div>
    </div>
  );
}

function UserAvatar({
  initials,
  isOnline,
  className = "",
}: {
  initials: string;
  isOnline?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111] text-[11px] font-bold text-[#D4FF4F] ${className}`}
    >
      {initials}
      {isOnline !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${isOnline ? "bg-[#2E7D5E]" : "bg-[#E8602C]"}`}
        />
      )}
    </div>
  );
}

function UserAvatarButton({
  initials,
  isOnline,
  onClick,
  className = "",
}: {
  initials: string;
  isOnline?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111] text-[11px] font-bold text-[#D4FF4F] transition-transform active:scale-95 ${className}`}
      aria-label="Account menu"
    >
      {initials}
      {isOnline !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${isOnline ? "bg-[#2E7D5E]" : "bg-[#E8602C]"}`}
        />
      )}
    </button>
  );
}

function UserMenuDropdown({
  open,
  onClose,
  onSettings,
  onSignOut,
  showSettings,
}: {
  open: boolean;
  onClose: () => void;
  onSettings: () => void;
  onSignOut: () => void;
  showSettings: boolean;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="cloud-user-menu">
        {showSettings && (
          <button type="button" className="cloud-user-menu-item" onClick={onSettings}>
            <Settings className="h-4 w-4" />
            Settings
          </button>
        )}
        <button type="button" className="cloud-user-menu-item cloud-user-menu-item--danger" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );
}

function WelcomeToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      setShow(true);
      const t = setTimeout(() => setShow(false), 4000);
      router.replace("/cloud/dashboard", { scroll: false });
      return () => clearTimeout(t);
    }
  }, [searchParams, router]);

  if (!show) return null;
  return (
    <div className="fixed bottom-28 left-1/2 z-[300] -translate-x-1/2 rounded-xl border border-[rgba(212,255,79,0.25)] bg-[var(--cloud-ink)] px-5 py-3 text-[13px] font-medium text-white shadow-[var(--cloud-shadow-elevated)] lg:bottom-6 font-cloud-body">
      Welcome to SegmiQ Cloud. Your workspace is ready.
    </div>
  );
}

export default function CloudDashboardShell({
  children,
  banner,
}: {
  children: React.ReactNode;
  banner?: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const normalizedPath = normalizeCloudDashboardPath(pathname);
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const onboardingChecked = useRef(false);

  useEffect(() => {
    if (!session?.clientId) return;
    fetch(`/api/clients`)
      .then((r) => r.json())
      .then((list: unknown) => {
        if (Array.isArray(list) && list.length > 0) {
          const client = (list as { id: string; name: string }[]).find(
            (c) => c.id === session.clientId
          ) ?? (list as { id: string; name: string }[])[0];
          if (client?.name) setBusinessName(client.name);
        }
      })
      .catch(() => {});
  }, [session?.clientId]);

  useEffect(() => {
    if (!session?.userId || session.role === "AGENCY_ADMIN" || !isCloudAdminRole(session.role)) return;
    if (onboardingChecked.current) return;
    if (matchesCloudDashboardPath(pathname, "/onboarding")) return;
    const cached = sessionStorage.getItem("lq_ob");
    if (cached === "1") return;
    onboardingChecked.current = true;
    fetch("/api/cloud/onboarding")
      .then((r) => r.json())
      .then((data: { completed?: boolean }) => {
        if (!data.completed) {
          router.push("/cloud/dashboard/onboarding");
        } else {
          sessionStorage.setItem("lq_ob", "1");
        }
      })
      .catch(() => {});
  }, [session?.userId, session?.role, pathname, router]);

  const isCloudAdmin = isCloudAdminRole(session?.role);

  useEffect(() => {
    if (!session?.role || isCloudAdmin) return;
    if (CLOUD_ADMIN_PATH_SUFFIXES.some((suffix) => matchesCloudDashboardPath(pathname, suffix))) {
      router.replace("/cloud/dashboard");
    }
  }, [isCloudAdmin, pathname, router, session?.role]);

  useEffect(() => {
    if (!session?.userId) return;
    fetch("/api/cloud/notifications?count=1")
      .then((r) => r.json())
      .then((data: { unread?: number }) => setUnreadCount(data.unread ?? 0))
      .catch(() => {});
  }, [session?.userId, pathname]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const displayName = businessName || "Segmiq Cloud";
  const initials = getInitials(session?.user?.name ?? "");
  const pageTitle = getPageTitle(pathname);
  const isHome = normalizedPath === "/cloud/dashboard";
  const isUploadPage = normalizedPath.startsWith("/cloud/dashboard/upload");

  const businessNav = isCloudAdmin ? BUSINESS_NAV : [];
  const accountNav = isCloudAdmin
    ? ACCOUNT_NAV
    : ACCOUNT_NAV.filter(
        (item) =>
          item.href !== "/cloud/dashboard/settings"
          && item.href !== "/cloud/dashboard/billing"
          && item.href !== "/cloud/dashboard/analytics"
      );

  return (
    <div className="cloud-dashboard flex h-[100dvh] min-h-screen bg-[var(--cloud-bg)] font-cloud-body text-[var(--cloud-text-primary)]">
      {/* ── Desktop sidebar ── */}
      <aside className="cloud-shell-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col lg:flex">
        {/* Brand */}
        <div className="flex h-[var(--cloud-topbar-height)] shrink-0 items-center gap-3 border-b border-[var(--cloud-border)] px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--cloud-ink)] shadow-[0_2px_8px_rgba(11,13,18,0.18)]">
            <CloudUpload className="h-[17px] w-[17px] text-[var(--cloud-accent)]" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-tight tracking-[-0.01em] text-[var(--cloud-text-primary)]">
              {displayName}
            </p>
            <p className="truncate text-[11px] font-medium text-[var(--cloud-text-tertiary)]">
              SegmiQ Cloud
            </p>
          </div>
        </div>

        {!isUploadPage && (
          <div className="px-4 pt-4 pb-1">
            <Link href="/cloud/dashboard/upload" className="cloud-shell-upload-btn">
              <Camera className="h-4 w-4" strokeWidth={2.2} />
              Upload photos
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="cloud-scroll-y flex-1 px-1 pb-4 pt-1">
          <NavSection title="Workspace" items={WORKSPACE_NAV} pathname={pathname} unreadCount={unreadCount} />
          <NavSection title="Business" items={businessNav} pathname={pathname} unreadCount={unreadCount} />
          <NavSection title="Account" items={accountNav} pathname={pathname} unreadCount={unreadCount} />
        </nav>

        {/* User footer */}
        <div className="border-t border-[var(--cloud-border)] p-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSidebarMenuOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-[var(--cloud-radius-sm)] px-2 py-2.5 text-left transition-colors hover:bg-[var(--cloud-surface-muted)]"
            >
              <UserAvatar initials={initials} isOnline={isOnline} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[var(--cloud-text-primary)]">
                  {session?.user?.name ?? "—"}
                </p>
                <p className="truncate text-[11px] capitalize text-[var(--cloud-text-tertiary)]">
                  {roleLabel(session?.role)}
                </p>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--cloud-text-tertiary)] transition-transform ${sidebarMenuOpen ? "rotate-180" : ""}`} />
            </button>
            <UserMenuDropdown
              open={sidebarMenuOpen}
              onClose={() => setSidebarMenuOpen(false)}
              showSettings={isCloudAdmin}
              onSettings={() => {
                setSidebarMenuOpen(false);
                router.push("/cloud/dashboard/settings");
              }}
              onSignOut={() => void signOut({ callbackUrl: "/cloud/login" })}
            />
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden lg:ml-[var(--cloud-sidebar-width)]">
        {/* Desktop top bar */}
        <header className="cloud-shell-topbar sticky top-0 z-20 hidden shrink-0 items-center justify-between px-8 lg:flex">
          <div className="min-w-0">
            {isHome ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cloud-text-tertiary)]">
                  Workspace
                </p>
                <h1 className="truncate font-cloud-display text-[22px] leading-tight tracking-[-0.02em] text-[var(--cloud-text-primary)]">
                  {displayName}
                </h1>
              </div>
            ) : pageTitle ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <Link
                  href="/cloud/dashboard"
                  className="shrink-0 text-[12px] font-medium text-[var(--cloud-text-tertiary)] transition-colors hover:text-[var(--cloud-text-primary)]"
                >
                  Home
                </Link>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--cloud-text-disabled)]" />
                <h1 className="truncate font-cloud-display text-[22px] leading-tight tracking-[-0.02em] text-[var(--cloud-text-primary)]">
                  {pageTitle}
                </h1>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <Link
                  href="/cloud/dashboard"
                  className="shrink-0 text-[12px] font-medium text-[var(--cloud-text-tertiary)] transition-colors hover:text-[var(--cloud-text-primary)]"
                >
                  Home
                </Link>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--cloud-text-disabled)]" />
                <Link
                  href="/cloud/dashboard/projects"
                  className="truncate font-cloud-display text-[22px] leading-tight tracking-[-0.02em] text-[var(--cloud-text-primary)] transition-colors hover:text-[var(--cloud-text-secondary)]"
                >
                  Projects
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/cloud/dashboard/notifications")}
              className="cloud-topbar-icon-btn relative"
              aria-label="Notifications"
            >
              <Bell className="h-[17px] w-[17px]" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--cloud-ink)] px-1 text-[9px] font-bold text-[var(--cloud-accent)]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {!isUploadPage && (
              <Link href="/cloud/dashboard/upload" className="cloud-btn-primary h-9 px-4 text-[12px]">
                <Camera className="h-3.5 w-3.5" strokeWidth={2.2} />
                Upload
              </Link>
            )}

            <div className="relative ml-1">
              <UserAvatarButton
                initials={initials}
                onClick={() => setHeaderMenuOpen((v) => !v)}
              />
              <UserMenuDropdown
                open={headerMenuOpen}
                onClose={() => setHeaderMenuOpen(false)}
                showSettings={isCloudAdmin}
                onSettings={() => {
                  setHeaderMenuOpen(false);
                  router.push("/cloud/dashboard/settings");
                }}
                onSignOut={() => void signOut({ callbackUrl: "/cloud/login" })}
              />
            </div>
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="cloud-shell-topbar sticky top-0 z-20 flex shrink-0 items-center justify-between px-5 lg:hidden">
          <div className="min-w-0 flex-1">
            {isHome ? (
              <>
                <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--cloud-text-primary)]">
                  {displayName}
                </p>
                <p className="text-[11px] font-medium text-[var(--cloud-text-tertiary)]">SegmiQ Cloud</p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-medium text-[var(--cloud-text-tertiary)]">SegmiQ Cloud</p>
                <p className="truncate font-cloud-display text-[18px] leading-tight tracking-[-0.02em] text-[var(--cloud-text-primary)]">
                  {pageTitle ?? "Projects"}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/cloud/dashboard/notifications")}
              className="cloud-topbar-icon-btn relative"
              aria-label="Notifications"
            >
              <Bell className="h-[17px] w-[17px]" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--cloud-accent)] ring-2 ring-white" />
              )}
            </button>
            <div className="relative">
              <UserAvatarButton
                initials={initials}
                isOnline={isOnline}
                onClick={() => setHeaderMenuOpen((v) => !v)}
              />
              <UserMenuDropdown
                open={headerMenuOpen}
                onClose={() => setHeaderMenuOpen(false)}
                showSettings={isCloudAdmin}
                onSettings={() => {
                  setHeaderMenuOpen(false);
                  router.push("/cloud/dashboard/settings");
                }}
                onSignOut={() => void signOut({ callbackUrl: "/cloud/login" })}
              />
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="fixed left-0 right-0 top-[var(--cloud-topbar-height)] z-50 flex items-center justify-center gap-2 bg-[var(--cloud-danger)] px-5 py-2">
            <p className="text-[12px] font-semibold text-white">
              No connection · Photos will upload when signal returns
            </p>
          </div>
        )}

        <main
          className="cloud-scroll-y min-h-0 flex-1 lg:pb-0"
          style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}
        >
          {banner}
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="cloud-bottom-nav fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-[var(--cloud-border)] bg-white/92 px-2 backdrop-blur-xl lg:hidden font-cloud-body"
        style={{ paddingTop: 8, paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        {MOBILE_NAV.map(({ href, icon: Icon, label }, idx) => {
          const active = href === "/cloud/dashboard/more"
            ? (matchesCloudDashboardPath(pathname, "/more")
                || matchesCloudDashboardPath(pathname, "/settings")
                || matchesCloudDashboardPath(pathname, "/pricing")
                || matchesCloudDashboardPath(pathname, "/billing")
                || matchesCloudDashboardPath(pathname, "/team")
                || matchesCloudDashboardPath(pathname, "/analytics"))
            : isActive(href, pathname);
          const isCenter = idx === 2;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center gap-1"
            >
              {isCenter ? (
                <div className="-mt-[20px] flex h-[50px] w-[50px] items-center justify-center rounded-[16px] bg-[var(--cloud-ink)] shadow-[0_6px_20px_rgba(11,13,18,0.28)] transition-transform active:scale-95">
                  <Icon className="h-[20px] w-[20px] text-[var(--cloud-accent)]" strokeWidth={2.2} />
                </div>
              ) : (
                <>
                  <div
                    className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      active ? "bg-[var(--cloud-accent-muted)]" : ""
                    }`}
                  >
                    <Icon
                      className="h-[20px] w-[20px]"
                      style={{ color: active ? "var(--cloud-text-primary)" : "var(--cloud-text-secondary)" }}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                    {href === "/cloud/dashboard/notifications" && unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--cloud-accent)] ring-2 ring-white" />
                    )}
                  </div>
                  {label && (
                    <span
                      className="text-[10px] tracking-[-0.01em]"
                      style={{
                        color: active ? "var(--cloud-text-primary)" : "var(--cloud-text-secondary)",
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      {label}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <Suspense>
        <WelcomeToast />
      </Suspense>
    </div>
  );
}
