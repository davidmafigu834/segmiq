"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, CircleHelp, LogOut, ShieldCheck, UserRound } from "lucide-react";
import {
  displaySalesName,
  salesNameInitials,
} from "@/lib/sales/navigation/sales-nav-config";
import { cn } from "@/lib/ui/cn";

export function SalesProfileMenu({
  userName,
  userRoleLabel = "Sales Executive",
  avatarUrl,
  compact,
  profileHref = "/sales/profile",
  helpHref = "/sales/training",
  helpLabel = "Training",
}: {
  userName: string;
  userRoleLabel?: string;
  avatarUrl?: string | null;
  /** Avatar-only trigger (narrow desktop / mobile header) */
  compact?: boolean;
  profileHref?: string;
  helpHref?: string;
  helpLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const name = displaySalesName(userName);
  const initials = salesNameInitials(userName);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-[10px] border border-transparent px-1.5 transition-colors duration-150",
          "hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
          open && "bg-sales-surface-hover"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-1 ring-sales-border"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sales-surface-subtle text-[11px] font-semibold text-sales-text-primary ring-1 ring-sales-border">
            {initials}
          </span>
        )}
        {!compact ? (
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block max-w-[120px] truncate text-[13px] font-semibold text-sales-text-primary">
              {name}
            </span>
            <span className="block max-w-[120px] truncate text-[11px] text-sales-text-muted">
              {userRoleLabel}
            </span>
          </span>
        ) : null}
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className={cn(
            "hidden text-sales-text-muted transition-transform duration-150 sm:block",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-[50] mt-2 w-56 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface py-1 shadow-sales-popover"
        >
          <div className="border-b border-sales-border-subtle px-3 py-2.5 lg:hidden">
            <p className="truncate text-[13px] font-semibold text-sales-text-primary">{name}</p>
            <p className="truncate text-[11px] text-sales-text-muted">{userRoleLabel}</p>
          </div>
          <Link
            href={profileHref}
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
            onClick={() => setOpen(false)}
          >
            <UserRound size={16} strokeWidth={1.8} aria-hidden />
            My profile
          </Link>
          <Link
            href={profileHref}
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
            onClick={() => setOpen(false)}
          >
            <ShieldCheck size={16} strokeWidth={1.8} aria-hidden />
            Account & security
          </Link>
          <Link
            href={helpHref}
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
            onClick={() => setOpen(false)}
          >
            <CircleHelp size={16} strokeWidth={1.8} aria-hidden />
            {helpLabel}
          </Link>
          <div className="my-1 border-t border-sales-border-subtle" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/login" });
            }}
          >
            <LogOut size={16} strokeWidth={1.8} aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
