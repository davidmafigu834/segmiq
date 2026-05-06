"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Grid, Folder, Camera, Users, Settings, LogOut, CloudUpload } from "lucide-react";

const NAV = [
  { href: "/cloud/dashboard", icon: Grid, label: "Home" },
  { href: "/cloud/dashboard/projects", icon: Folder, label: "Projects" },
  { href: "/cloud/dashboard/upload", icon: Camera, label: "Upload" },
  { href: "/cloud/dashboard/team", icon: Users, label: "Team" },
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
  return "Cloud";
}

export default function CloudDashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [businessName, setBusinessName] = useState<string>("");

  useEffect(() => {
    if (session?.clientId) {
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
    }
  }, [session?.clientId]);

  const displayName = businessName || session?.user?.name || "Leadstaq Cloud";
  const initials = (session?.user?.name ?? "U").slice(0, 1).toUpperCase();
  const pageTitle = pageTitleFor(pathname);

  return (
    <div className="flex min-h-screen bg-black">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] flex-col border-r border-white/[0.08] bg-black lg:flex">
        {/* Logo / brand */}
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-white/[0.08] px-4">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[#D4FF4F]">
            <CloudUpload className="h-3.5 w-3.5 text-black" strokeWidth={2.5} />
          </div>
          <span className="max-w-[160px] truncate text-[13px] font-medium text-white">{displayName}</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-0.5 py-2">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex h-8 items-center gap-2.5 rounded-md px-3 mx-1 text-[13px] transition-colors ${
                isActive(href, pathname)
                  ? "bg-[#111] text-white font-medium"
                  : "text-[#888] hover:text-white hover:bg-[#111]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="p-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[#D4FF4F] text-[10px] font-bold text-black">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-white">{session?.user?.name ?? "—"}</p>
              <p className="text-[10px] text-[#555] uppercase tracking-wide">{session?.role}</p>
            </div>
          </div>
          <button
            onClick={() => void signOut({ callbackUrl: "/cloud/login" })}
            className="flex w-full items-center gap-2 mt-2 px-2 py-1.5 text-[12px] text-[#555] hover:text-[#888] rounded-md hover:bg-[#111] transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-[220px]">
        {/* Top bar — desktop */}
        <header className="sticky top-0 z-10 hidden h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-black px-4 lg:flex">
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-medium text-white">{pageTitle}</span>
          </div>
          <Link
            href="/cloud/dashboard/upload"
            className="flex items-center gap-1.5 h-8 px-3 bg-[#D4FF4F] text-black text-[12px] font-semibold rounded-md hover:bg-[#c8f244] transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            Upload photos
          </Link>
        </header>

        {/* Page content — bottom-padded for mobile tab bar */}
        <main className="flex-1 pb-24 lg:pb-6">{children}</main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-black safe-bottom lg:hidden">
        <div className="flex items-end">
          {NAV.map(({ href, icon: Icon, label }, idx) => {
            const active = isActive(href, pathname);
            const isCenter = idx === 2;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors ${
                  isCenter ? "relative -mt-4" : active ? "text-accent" : "text-[var(--text-tertiary)]"
                }`}
              >
                {isCenter ? (
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                      active ? "bg-[var(--accent-hover)]" : "bg-[var(--accent)]"
                    }`}
                  >
                    <Icon className="h-6 w-6 text-black" />
                  </div>
                ) : (
                  <>
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
