"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Grid, Folder, Camera, Users, Settings, LayoutGrid, LogOut, CloudUpload,
  Bell, CreditCard, HelpCircle, BarChart2, Tag, ChevronsUpDown,
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
  { href: "/cloud/dashboard/help", icon: HelpCircle, label: "Help" },
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
  if (p.startsWith("/cloud/dashboard/activity")) return "Activity";
  if (p.startsWith("/cloud/dashboard/analytics")) return "Analytics";
  if (p.startsWith("/cloud/dashboard/billing")) return "Billing";
  if (p.startsWith("/cloud/dashboard/more")) return "More";
  if (p.startsWith("/cloud/dashboard/help")) return "Help";
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
  const showBadge = badge === "notifications" && unreadCount > 0;
  return (
    <Link
      href={href}
      className={`cloud-nav-link ${active ? "cloud-nav-link--active" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.1 : 1.7} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {showBadge ? (
        <span className="cloud-nav-link-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
      ) : null}
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
      <div className="flex flex-col">
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
  placement = "down",
}: {
  open: boolean;
  onClose: () => void;
  onSettings: () => void;
  onSignOut: () => void;
  showSettings: boolean;
  placement?: "up" | "down";
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className={`cloud-user-menu ${placement === "up" ? "cloud-user-menu--up" : ""}`}>
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
        <div className="shrink-0 px-3 pt-3">
          <Link href="/cloud/dashboard" className="cloud-shell-workspace">
            <span className="cloud-shell-workspace-mark">
              <CloudUpload className="h-3.5 w-3.5 text-[var(--cloud-accent)]" strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-[var(--cloud-text-primary)]">
                {displayName}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-[var(--cloud-text-tertiary)]">
                SegmiQ Cloud
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--cloud-text-tertiary)]" strokeWidth={1.8} />
          </Link>
        </div>

        {!isUploadPage && (
          <div className="shrink-0 px-3 pt-3">
            <Link href="/cloud/dashboard/upload" className="cloud-shell-upload-btn">
              <Camera className="h-3.5 w-3.5" strokeWidth={2.2} />
              Upload photos
            </Link>
          </div>
        )}

        <nav className="cloud-shell-nav cloud-scroll-y flex-1 px-3 pb-3 pt-3">
          <NavSection title="Workspace" items={WORKSPACE_NAV} pathname={pathname} unreadCount={unreadCount} />
          <NavSection title="Business" items={businessNav} pathname={pathname} unreadCount={unreadCount} />
          <NavSection title="Account" items={accountNav} pathname={pathname} unreadCount={unreadCount} />
        </nav>

        <div className="shrink-0 border-t border-[var(--cloud-border)] p-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSidebarMenuOpen((v) => !v)}
              className="cloud-shell-account"
            >
              <UserAvatar initials={initials} isOnline={isOnline} className="!h-8 !w-8 text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--cloud-text-primary)]">
                  {session?.user?.name ?? "—"}
                </span>
                <span className="mt-0.5 block truncate text-[11px] capitalize text-[var(--cloud-text-tertiary)]">
                  {roleLabel(session?.role)}
                </span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--cloud-text-tertiary)]" strokeWidth={1.8} />
            </button>
            <UserMenuDropdown
              open={sidebarMenuOpen}
              onClose={() => setSidebarMenuOpen(false)}
              placement="up"
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

      {/* ── Main column (no desktop top bar — chrome lives in the sidebar) ── */}
      <div className="flex h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden lg:ml-[var(--cloud-sidebar-width)]">
        {/* Mobile top bar only */}
        <header className="cloud-shell-topbar sticky top-0 z-20 shrink-0 px-4 lg:hidden">
          <div className="cloud-shell-topbar-inner">
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
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => router.push("/cloud/dashboard/notifications")}
                className="cloud-topbar-icon-btn relative !h-11 !w-11"
                aria-label="Notifications"
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
                {unreadCount > 0 && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--cloud-accent)] ring-2 ring-white" />
                )}
              </button>
              <div className="relative">
                <UserAvatarButton
                  initials={initials}
                  isOnline={isOnline}
                  onClick={() => setHeaderMenuOpen((v) => !v)}
                  className="!h-11 !w-11 text-[12px]"
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
          </div>
        </header>

        {!isOnline && (
          <div className="fixed left-0 right-0 top-[calc(var(--cloud-topbar-height)+env(safe-area-inset-top,0px))] z-50 flex items-center justify-center gap-2 bg-[var(--cloud-danger)] px-5 py-2 lg:left-[var(--cloud-sidebar-width)] lg:top-0">
            <p className="text-[12px] font-semibold text-white">
              No connection · Photos will upload when signal returns
            </p>
          </div>
        )}

        <main
          className="cloud-scroll-y min-h-0 flex-1 overflow-x-clip lg:!pb-0"
          style={{ paddingBottom: "var(--cloud-main-pad-bottom)" }}
        >
          {banner}
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="cloud-bottom-nav fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-[var(--cloud-border)] px-1 backdrop-blur-xl lg:hidden font-cloud-body"
        aria-label="Primary"
      >
        {MOBILE_NAV.map(({ href, icon: Icon, label }, idx) => {
          const active = href === "/cloud/dashboard/more"
            ? (matchesCloudDashboardPath(pathname, "/more")
                || matchesCloudDashboardPath(pathname, "/settings")
                || matchesCloudDashboardPath(pathname, "/pricing")
                || matchesCloudDashboardPath(pathname, "/billing")
                || matchesCloudDashboardPath(pathname, "/team")
                || matchesCloudDashboardPath(pathname, "/analytics")
                || matchesCloudDashboardPath(pathname, "/help")
                || matchesCloudDashboardPath(pathname, "/activity"))
            : isActive(href, pathname);
          const isCenter = idx === 2;
          return (
            <Link
              key={href}
              href={href}
              className="cloud-bottom-nav-item"
              aria-label={label || "Upload"}
              aria-current={active ? "page" : undefined}
            >
              {isCenter ? (
                <div className="cloud-bottom-nav-fab">
                  <Icon className="h-5 w-5 text-[var(--cloud-accent)]" strokeWidth={2.2} />
                </div>
              ) : (
                <>
                  <div
                    className={`relative flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors ${
                      active ? "bg-[var(--cloud-accent-muted)]" : ""
                    }`}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: active ? "var(--cloud-text-primary)" : "var(--cloud-text-secondary)" }}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                    {href === "/cloud/dashboard/notifications" && unreadCount > 0 && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--cloud-accent)] ring-2 ring-white" />
                    )}
                  </div>
                  {label ? (
                    <span
                      className="max-w-full truncate px-0.5 text-[10px] tracking-[-0.01em]"
                      style={{
                        color: active ? "var(--cloud-text-primary)" : "var(--cloud-text-secondary)",
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      {label}
                    </span>
                  ) : null}
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
