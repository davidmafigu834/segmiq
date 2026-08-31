"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronDown, CircleHelp, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { ExitImpersonationMenuItem } from "@/components/agency/ExitImpersonationMenuItem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/sales/ui";
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
  const router = useRouter();

  const name = displaySalesName(userName);
  const initials = salesNameInitials(userName);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} align="end">
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-[10px] border border-transparent px-1.5 transition-colors duration-150",
          "hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
          open && "bg-sales-surface-hover"
        )}
        aria-label="Account menu"
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
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56">
        <div className="border-b border-sales-border-subtle px-3 py-2.5 lg:hidden">
          <p className="truncate text-[13px] font-semibold text-sales-text-primary">{name}</p>
          <p className="truncate text-[11px] text-sales-text-muted">{userRoleLabel}</p>
        </div>
        <DropdownMenuItem icon={<UserRound size={16} strokeWidth={1.8} />} onSelect={() => router.push(profileHref)}>
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem icon={<ShieldCheck size={16} strokeWidth={1.8} />} onSelect={() => router.push(profileHref)}>
          Account & security
        </DropdownMenuItem>
        <DropdownMenuItem icon={<CircleHelp size={16} strokeWidth={1.8} />} onSelect={() => router.push(helpHref)}>
          {helpLabel}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ExitImpersonationMenuItem
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-sales-text-primary hover:bg-sales-surface-hover disabled:opacity-60"
          onSelect={() => setOpen(false)}
        />
        <DropdownMenuItem
          icon={<LogOut size={16} strokeWidth={1.8} />}
          onSelect={() => void signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
