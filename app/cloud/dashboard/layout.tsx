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

function pageTitleFor(pathname: string): string {
  if (pathname === "/cloud/dashboard") return "Home";
  if (pathname.startsWith("/cloud/dashboard/projects")) return "Projects";
  if (pathname.startsWith("/cloud/dashboard/upload")) return "Upload";
  if (pathname.startsWith("/cloud/dashboard/team")) return "Team";
  if (pathname.startsWith("/cloud/dashboard/settings")) return "Settings";
  if (pathname.startsWith("/cloud/dashboard/notifications")) return "Notifications";
  if (pathname.startsWith("/cloud/dashboard/billing")) return "Billing";
  if (pathname.startsWith("/cloud/help")) return "Help";
  return "Cloud";
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
    <div className="fixed bottom-28 left-1/2 z-[300] -translate-x-1/2 rounded-xl border border-[#D4FF4F]/20 bg-[#111] px-5 py-3 text-[13px] font-medium text-white shadow-xl lg:bottom-6">
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
  const initials = (session?.user?.name ?? "U").slice(0, 1).toUpperCase();
  const pageTitle = pageTitleFor(pathname);

  return (
    <div className="flex min-h-screen bg-black">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-white/[0.08] bg-black lg:flex">
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-white/[0.08] px-4">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[#D4FF4F]">
            <CloudUpload className="h-3.5 w-3.5 text-black" strokeWidth={2.5} />
          </div>
          <span className="max-w-[180px] truncate text-[14px] font-medium text-white">{displayName}</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {PRIMARY_NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex h-8 items-center gap-2.5 rounded-md px-3 mx-1 text-[14px] transition-colors ${
                isActive(href, pathname)
                  ? "bg-[#111] text-white font-medium"
                  : "text-[#888] hover:text-white hover:bg-[#111]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
          <div className="my-2 mx-3 border-t border-white/[0.06]" />
          {SECONDARY_NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex h-8 items-center gap-2.5 rounded-md px-3 mx-1 text-[13px] transition-colors ${
                isActive(href, pathname)
                  ? "bg-[#111] text-white font-medium"
                  : "text-[#666] hover:text-white hover:bg-[#111]"
              }`}
            >
              <div className="relative shrink-0">
                <Icon className="h-4 w-4" />
                {label === "Notifications" && unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#D4FF4F]" />
                )}
              </div>
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[#D4FF4F] text-[11px] font-bold text-black">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-white">{session?.user?.name ?? "—"}</p>
              <p className="text-[12px] text-[#555] uppercase tracking-wide">{session?.role}</p>
            </div>
          </div>
          <button
            onClick={() => void signOut({ callbackUrl: "/cloud/login" })}
            className="flex w-full items-center gap-2 mt-2 px-2 py-1.5 text-[14px] text-[#555] hover:text-[#888] rounded-md hover:bg-[#111] transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-[240px]">
        <header className="sticky top-0 z-10 hidden h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-black px-4 lg:flex">
          <span className="text-[14px] font-medium text-white">{pageTitle}</span>
          <div className="flex items-center gap-2">
            <Link
              href="/cloud/dashboard/notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-md text-[#555] transition-colors hover:bg-[#111] hover:text-white"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#D4FF4F]" />
              )}
            </Link>
            <Link
              href="/cloud/dashboard/upload"
              className="flex items-center gap-1.5 h-8 px-3 bg-[#D4FF4F] text-black text-[13px] font-semibold rounded-md hover:bg-[#c8f244] transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              Upload photos
            </Link>
          </div>
        </header>

        <main className="flex-1 pb-24 lg:pb-6">{children}</main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-black safe-bottom lg:hidden">
        <div className="flex items-end">
          {MOBILE_NAV.map(({ href, icon: Icon, label }, idx) => {
            const active = isActive(href, pathname);
            const isCenter = idx === 2;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors ${
                  isCenter ? "relative -mt-4" : active ? "text-white" : "text-[#555]"
                }`}
              >
                {isCenter ? (
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                      active ? "bg-[#c4ef3f]" : "bg-[#D4FF4F]"
                    }`}
                  >
                    <Icon className="h-6 w-6 text-black" />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Icon className="h-5 w-5" />
                      {href === "/cloud/dashboard/notifications" && unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#D4FF4F]" />
                      )}
                    </div>
                    {label && <span>{label}</span>}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <Suspense>
        <WelcomeToast />
      </Suspense>
    </div>
  );
}
