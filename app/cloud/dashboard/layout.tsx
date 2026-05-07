"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Grid, Folder, Camera, Users, Settings, LogOut, CloudUpload,
  Bell, CreditCard, HelpCircle,
} from "lucide-react";
import { Suspense } from "react";

const PRIMARY_NAV = [
  { href: "/cloud/dashboard", icon: Grid, label: "Home" },
  { href: "/cloud/dashboard/projects", icon: Folder, label: "Projects" },
  { href: "/cloud/dashboard/upload", icon: Camera, label: "Upload" },
  { href: "/cloud/dashboard/team", icon: Users, label: "Team" },
];

const SECONDARY_NAV = [
  { href: "/cloud/dashboard/notifications", icon: Bell, label: "Notifications" },
  { href: "/cloud/dashboard/billing", icon: CreditCard, label: "Billing" },
  { href: "/cloud/dashboard/settings", icon: Settings, label: "Settings" },
  { href: "/cloud/help", icon: HelpCircle, label: "Help" },
];

const MOBILE_NAV = [
  { href: "/cloud/dashboard", icon: Grid, label: "Home" },
  { href: "/cloud/dashboard/projects", icon: Folder, label: "Projects" },
  { href: "/cloud/dashboard/upload", icon: Camera, label: "Upload" },
  { href: "/cloud/dashboard/notifications", icon: Bell, label: "" },
  { href: "/cloud/dashboard/settings", icon: Settings, label: "Settings" },
];

function isActive(href: string, pathname: string) {
  if (href === "/cloud/dashboard") return pathname === href;
  return pathname.startsWith(href);
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "ME";
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
    <div className="fixed bottom-28 left-1/2 z-[300] -translate-x-1/2 rounded-xl border border-[#D4FF4F]/20 bg-[#111] px-5 py-3 text-[13px] font-medium text-white shadow-xl lg:bottom-6 font-cloud-body">
      Welcome to Leadstaq Cloud. Your account is ready. 🎉
    </div>
  );
}

export default function CloudDashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>("");
  const [unreadCount, setUnreadCount] = useState(0);
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
    if (!session?.userId || session.role === "AGENCY_ADMIN") return;
    if (onboardingChecked.current) return;
    if (pathname.startsWith("/cloud/dashboard/onboarding")) return;
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

  useEffect(() => {
    if (!session?.userId) return;
    fetch("/api/cloud/notifications?count=1")
      .then((r) => r.json())
      .then((data: { unread?: number }) => setUnreadCount(data.unread ?? 0))
      .catch(() => {});
  }, [session?.userId, pathname]);

  const displayName = businessName || session?.user?.name || "Leadstaq Cloud";
  const initials = getInitials(session?.user?.name ?? "");

  return (
    <div className="flex min-h-screen bg-[#F7F7F8] font-cloud-body">
      {/* Sidebar — desktop only */}
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-black/[0.07] bg-white lg:flex" style={{ boxShadow: '1px 0 0 rgba(0,0,0,0.04)' }}>
        <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-black/[0.06] px-5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#D4FF4F]">
            <CloudUpload className="h-4 w-4 text-black" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-cloud-display text-[15px] text-[#0a0a0a] leading-tight">{displayName}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {PRIMARY_NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex h-9 items-center gap-2.5 rounded-xl px-3 mb-0.5 text-[13px] font-medium transition-colors ${
                isActive(href, pathname)
                  ? "bg-[#F5F5F0] text-[#0a0a0a]"
                  : "text-[#666660] hover:text-[#0a0a0a] hover:bg-[#F5F5F0]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive(href, pathname) ? 2.2 : 1.8} />
              {label}
            </Link>
          ))}
          <div className="my-3 mx-1 border-t border-black/[0.06]" />
          {SECONDARY_NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex h-9 items-center gap-2.5 rounded-xl px-3 mb-0.5 text-[13px] transition-colors ${
                isActive(href, pathname)
                  ? "bg-[#F5F5F0] text-[#0a0a0a] font-medium"
                  : "text-[#999990] hover:text-[#0a0a0a] hover:bg-[#F5F5F0]"
              }`}
            >
              <div className="relative shrink-0">
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {label === "Notifications" && unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#D4FF4F]" />
                )}
              </div>
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-black/[0.06]">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-[10px] font-bold text-[#D4FF4F]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[#0a0a0a]">{session?.user?.name ?? "—"}</p>
              <p className="text-[11px] text-[#999990] uppercase tracking-wide">{session?.role === "CLIENT_MANAGER" ? "Manager" : session?.role}</p>
            </div>
          </div>
          <button
            onClick={() => void signOut({ callbackUrl: "/cloud/login" })}
            className="flex w-full items-center gap-2 mt-1 px-3 py-2 text-[13px] text-[#999990] hover:text-[#0a0a0a] rounded-xl hover:bg-[#F5F5F0] transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-[240px]">
        {/* Desktop topbar */}
        <header className="sticky top-0 z-10 hidden h-[56px] shrink-0 items-center justify-between border-b border-black/[0.06] bg-[#F7F7F8] px-5 lg:flex">
          <div>
            <p className="font-cloud-body text-[12px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">{getGreeting()}</p>
            <p className="font-cloud-display text-[20px] text-[#111111] leading-tight">{displayName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/cloud/dashboard/notifications")}
              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white border border-black/[0.08] text-[#6B7280] transition-colors hover:border-black/[0.15] hover:text-[#111111] active:scale-95 cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#D4FF4F] border-2 border-[#F7F7F8]" />
              )}
            </button>
            <Link
              href="/cloud/dashboard/upload"
              className="flex items-center gap-1.5 h-[34px] px-4 bg-[#D4FF4F] text-[#111111] text-[12px] font-bold rounded-xl hover:bg-[#C8F244] transition-colors font-cloud-body"
            >
              <Camera className="w-3.5 h-3.5" />
              Upload
            </Link>
          </div>
        </header>

        {/* Mobile topbar */}
        <header className="sticky top-0 z-10 flex h-[56px] shrink-0 items-center justify-between border-b border-black/[0.06] bg-[#F7F7F8] px-5 lg:hidden">
          <div>
            <p className="font-cloud-body text-[12px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">{getGreeting()}</p>
            <p className="font-cloud-display text-[22px] text-[#111111] leading-tight">{displayName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/cloud/dashboard/notifications")}
              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white border border-black/[0.08] text-[#6B7280] active:scale-95 transition-transform cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#D4FF4F] border-2 border-[#F5F5F0]" />
              )}
            </button>
            <button
              onClick={() => router.push("/cloud/dashboard/settings")}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#111111] text-[11px] font-bold text-[#D4FF4F] active:scale-95 transition-transform cursor-pointer"
              aria-label="Account settings"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {initials}
            </button>
          </div>
        </header>

        <main className="flex-1 pb-[calc(var(--cloud-nav-height)+20px)] lg:pb-8">{children}</main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-black/[0.08] flex items-center justify-around px-2 lg:hidden font-cloud-body"
        style={{ paddingTop: 10, paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        {MOBILE_NAV.map(({ href, icon: Icon, label }, idx) => {
          const active = isActive(href, pathname);
          const isCenter = idx === 2;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-[3px]"
            >
              {isCenter ? (
                <div
                  className="flex items-center justify-center rounded-full bg-[#D4FF4F]"
                  style={{ width: 52, height: 52, marginTop: -22, boxShadow: '0 6px 20px rgba(212,255,79,0.45)' }}
                >
                  <Icon className="h-[22px] w-[22px] text-[#111111]" strokeWidth={2} />
                </div>
              ) : (
                <>
                  <div className="relative flex items-center justify-center h-[22px] w-[22px]">
                    <Icon
                      className="h-[22px] w-[22px]"
                      style={{ color: active ? '#111111' : '#C0C0BE' }}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                    {href === "/cloud/dashboard/notifications" && unreadCount > 0 && (
                      <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-[#D4FF4F]" />
                    )}
                  </div>
                  {label && (
                    <span
                      className="text-[12px] font-semibold"
                      style={{ color: active ? '#111111' : '#C0C0BE' }}
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
