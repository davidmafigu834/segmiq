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
import { displaySalesName } from "@/lib/sales/navigation/sales-nav-config";
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
  /** Avatar-only trigger on narrow widths */
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
          "inline-flex h-9 max-w-[200px] shrink-0 items-center gap-2 rounded-[8px] border border-transparent py-0 pl-0.5 pr-1.5",
          "transition-[background-color,border-color,box-shadow] duration-150",
          "hover:border-sales-border hover:bg-sales-surface-hover",
          "focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
          open && "border-sales-border bg-sales-surface-hover"
        )}
        aria-label="Account menu"
      >
        <Avatar name={name} src={avatarUrl} size="sm" presence={presence} alt="" />
        {!compact ? (
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block max-w-[120px] truncate text-[13px] font-semibold leading-tight text-sales-text-primary">
              {name}
            </span>
            <span className="block max-w-[120px] truncate text-[11px] leading-tight text-sales-text-muted">
              {userRoleLabel}
            </span>
          </span>
        ) : (
          <span className="hidden min-w-0 text-left xl:block">
            <span className="block max-w-[108px] truncate text-[13px] font-semibold leading-tight text-sales-text-primary">
              {name}
            </span>
          </span>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className={cn(
            "shrink-0 text-sales-text-muted transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-sales-border-subtle bg-sales-surface-subtle/60 px-3 py-3">
          <Avatar name={name} src={avatarUrl} size="md" presence={presence} alt="" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-sales-text-primary">{name}</p>
            <p className="truncate text-[11px] text-sales-text-muted">{userRoleLabel}</p>
            {presence ? (
              <p className="mt-0.5 text-[11px] text-sales-text-secondary">{PRESENCE_LABEL[presence]}</p>
            ) : null}
          </div>
        </div>

        <div className="py-1.5">
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
            className="flex w-full min-h-10 items-center gap-2 px-3 py-2 text-left text-[13px] font-normal text-sales-text-primary transition-colors hover:bg-[var(--sales-menu-hover,rgba(16,24,40,0.04))] focus-visible:bg-[var(--sales-menu-hover,rgba(16,24,40,0.04))] disabled:cursor-not-allowed disabled:opacity-50"
            onSelect={() => setOpen(false)}
          />
          <DropdownMenuItem
            destructive
            icon={<LogOut size={16} strokeWidth={1.8} />}
            onSelect={() => void signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
