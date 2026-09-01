"use client";

import Link from "next/link";
import { Avatar, type AvatarSize } from "./Avatar";
import { PresenceIndicator } from "./PresenceIndicator";
import { displayName } from "@/lib/ui/initials";
import type { PresenceState } from "@/lib/presence/constants";
import { cn } from "@/lib/ui/cn";

export function UserIdentity({
  name,
  src,
  secondary,
  tertiary,
  href,
  size = "md",
  presence,
  showPresenceLabel = false,
  className,
}: {
  name: string;
  src?: string | null;
  secondary?: string | null;
  tertiary?: string | null;
  href?: string;
  size?: "compact" | "md" | "lg";
  presence?: PresenceState | null;
  showPresenceLabel?: boolean;
  className?: string;
}) {
  const avatarSize: AvatarSize = size === "compact" ? "sm" : size === "lg" ? "lg" : "md";
  const title = displayName(name);

  const nameEl = (
    <p
      className={cn(
        "truncate font-semibold text-sales-text-primary",
        size === "compact" ? "text-[13px]" : "text-[13px]"
      )}
      title={title}
    >
      {title}
    </p>
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar name={title} src={src} size={avatarSize} presence={presence} />
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="hover:text-sales-brand-fg focus-visible:outline-none">
            {nameEl}
          </Link>
        ) : (
          nameEl
        )}
        {secondary ? (
          <p className="truncate text-[11px] text-sales-text-secondary" title={secondary}>
            {secondary}
          </p>
        ) : null}
        {tertiary ? (
          <p className="truncate text-[10px] text-sales-text-muted" title={tertiary}>
            {tertiary}
          </p>
        ) : null}
        {showPresenceLabel && presence ? (
          <PresenceIndicator state={presence} size="sm" className="mt-0.5" />
        ) : null}
      </div>
    </div>
  );
}

export function CompanyIdentity({
  name,
  src,
  secondary,
  href,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  secondary?: string | null;
  href?: string;
  size?: "compact" | "md" | "lg";
  className?: string;
}) {
  const avatarSize: AvatarSize = size === "compact" ? "sm" : size === "lg" ? "lg" : "md";
  const title = displayName(name);

  const nameEl = (
    <p className="truncate text-[13px] font-semibold text-sales-text-primary" title={title}>
      {title}
    </p>
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar name={title} src={src} size={avatarSize} shape="square" />
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="hover:text-sales-brand-fg focus-visible:outline-none">
            {nameEl}
          </Link>
        ) : (
          nameEl
        )}
        {secondary ? (
          <p className="truncate text-[11px] text-sales-text-secondary" title={secondary}>
            {secondary}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function LeadIdentity({
  name,
  src,
  secondary,
  href,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  secondary?: string | null;
  href?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const avatarSize: AvatarSize = size === "sm" ? "sm" : "md";

  return (
    <UserIdentity
      name={name}
      src={src}
      secondary={secondary}
      href={href}
      size={size === "sm" ? "compact" : "md"}
      className={className}
    />
  );
}
