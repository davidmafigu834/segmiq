"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Check,
  ChevronDown,
  Circle,
  CircleAlert,
  CircleHelp,
  Clock3,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { ExitImpersonationMenuItem } from "@/components/agency/ExitImpersonationMenuItem";
import { Avatar } from "@/components/sales/ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/sales/ui";
import {
  displaySalesName,
} from "@/lib/sales/navigation/sales-nav-config";
import type { AvailabilityOverride, PresenceState } from "@/lib/presence/constants";
import { PRESENCE_LABEL } from "@/lib/presence/constants";
import { setAvailabilityOverride } from "@/hooks/usePresenceHeartbeat";
import { cn } from "@/lib/ui/cn";

type AvailabilityChoice = "AVAILABLE" | "AWAY" | "BUSY";

const AVAILABILITY_OPTIONS: {
  value: AvailabilityChoice;
  label: string;
  icon: typeof Circle;
}[] = [
  { value: "AVAILABLE", label: "Available", icon: Circle },
  { value: "AWAY", label: "Away", icon: Clock3 },
  { value: "BUSY", label: "Busy", icon: CircleAlert },
];

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
  const [presence, setPresence] = useState<PresenceState | null>(null);
  const [availability, setAvailability] = useState<AvailabilityOverride | null>(null);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const router = useRouter();

  const name = displaySalesName(userName);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/users/me/presence");
        if (!res.ok) return;
        const json = (await res.json()) as {
          presence?: PresenceState;
          availabilityOverride?: AvailabilityOverride | null;
        };
        if (cancelled) return;
        if (json.presence) setPresence(json.presence);
        setAvailability(json.availabilityOverride ?? null);
      } catch {
        // non-blocking
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onAvailability(next: AvailabilityChoice) {
    if (savingAvailability) return;
    setSavingAvailability(true);
    try {
      await setAvailabilityOverride(next);
      const res = await fetch("/api/users/me/presence");
      if (res.ok) {
        const json = (await res.json()) as {
          presence?: PresenceState;
          availabilityOverride?: AvailabilityOverride | null;
        };
        if (json.presence) setPresence(json.presence);
        setAvailability(json.availabilityOverride ?? null);
      }
    } catch {
      // keep previous state
    } finally {
      setSavingAvailability(false);
    }
  }

  const activeAvailability: AvailabilityChoice =
    availability === "AWAY" ? "AWAY" : availability === "BUSY" ? "BUSY" : "AVAILABLE";

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
        <Avatar name={name} src={avatarUrl} size="sm" presence={presence} alt="" />
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
          {presence ? (
            <p className="mt-0.5 text-[11px] text-sales-text-secondary">{PRESENCE_LABEL[presence]}</p>
          ) : null}
        </div>
        <DropdownMenuItem icon={<UserRound size={16} strokeWidth={1.8} />} onSelect={() => router.push(profileHref)}>
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem icon={<ShieldCheck size={16} strokeWidth={1.8} />} onSelect={() => router.push(profileHref)}>
          Account & security
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Availability</DropdownMenuLabel>
        {AVAILABILITY_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = activeAvailability === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              icon={<Icon size={16} strokeWidth={1.8} />}
              onSelect={() => void onAvailability(option.value)}
              disabled={savingAvailability}
            >
              <span className="flex flex-1 items-center justify-between gap-2">
                {option.label}
                {selected ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<CircleHelp size={16} strokeWidth={1.8} />} onSelect={() => router.push(helpHref)}>
          {helpLabel}
        </DropdownMenuItem>
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
