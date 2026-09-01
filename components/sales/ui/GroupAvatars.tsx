"use client";

import { Avatar, type AvatarSize } from "./Avatar";
import { getInitials } from "@/lib/ui/initials";
import type { PresenceState } from "@/lib/presence/constants";
import { cn } from "@/lib/ui/cn";

export type GroupAvatarMember = {
  id: string;
  name: string;
  src?: string | null;
  presence?: PresenceState | null;
};

export function GroupAvatars({
  members,
  maxVisible = 3,
  size = "sm",
  label,
  className,
}: {
  members: GroupAvatarMember[];
  maxVisible?: number;
  size?: AvatarSize;
  /** Accessible summary, e.g. "Sales team: 8 members" */
  label?: string;
  className?: string;
}) {
  if (members.length === 0) return null;

  const visible = members.slice(0, maxVisible);
  const remaining = members.length - visible.length;
  const summary =
    label ??
    `${members.map((m) => m.name).slice(0, maxVisible).join(", ")}${
      remaining > 0 ? `, and ${remaining} others` : ""
    }`;

  return (
    <div className={cn("inline-flex items-center", className)} aria-label={summary}>
      <div className="flex items-center">
        {visible.map((member, index) => (
          <span
            key={member.id}
            className={cn("relative inline-flex", index > 0 && "-ml-2")}
            style={{ zIndex: visible.length - index }}
          >
            <Avatar
              name={member.name}
              src={member.src}
              size={size}
              presence={member.presence}
              className="ring-2 ring-sales-surface"
            />
          </span>
        ))}
        {remaining > 0 ? (
          <span
            className={cn(
              "-ml-2 inline-flex items-center justify-center rounded-full bg-[var(--sales-neutral-100)] font-semibold text-sales-text-secondary ring-2 ring-sales-surface",
              size === "2xs" && "h-5 w-5 text-[9px]",
              size === "xs" && "h-6 w-6 text-[10px]",
              size === "sm" && "h-7 w-7 text-[11px]",
              size === "md" && "h-9 w-9 text-[12px]",
              size === "lg" && "h-11 w-11 text-[13px]",
              size === "xl" && "h-[52px] w-[52px] text-[14px]",
              size === "2xl" && "h-16 w-16 text-[15px]"
            )}
            aria-hidden
          >
            +{remaining}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated use getInitials from lib/ui/initials */
export function groupMemberInitials(name: string): string {
  return getInitials(name);
}
