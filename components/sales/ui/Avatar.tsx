"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { getInitials, getInitialsBackground } from "@/lib/ui/initials";
import type { PresenceState } from "@/lib/presence/constants";
import { PresenceIndicator } from "./PresenceIndicator";

export type AvatarSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type AvatarShape = "circle" | "square";

const SIZE_CLASS: Record<AvatarSize, string> = {
  "2xs": "h-5 w-5 text-[9px]",
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-[12px]",
  lg: "h-11 w-11 text-[13px]",
  xl: "h-[52px] w-[52px] text-[14px]",
  "2xl": "h-16 w-16 text-[15px]",
};

const PRESENCE_DOT: Record<AvatarSize, "sm" | "md" | "lg"> = {
  "2xs": "sm",
  xs: "sm",
  sm: "sm",
  md: "md",
  lg: "md",
  xl: "lg",
  "2xl": "lg",
};

export function Avatar({
  name,
  src,
  size = "md",
  shape = "circle",
  className,
  selected = false,
  presence,
  alt,
}: {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** circle for people, square for organizations */
  shape?: AvatarShape;
  className?: string;
  selected?: boolean;
  presence?: PresenceState | null;
  /** Override alt text; defaults to name when image is meaningful */
  alt?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getInitials(name);
  const showImage = Boolean(src?.trim()) && !imageFailed;
  const rounded = shape === "circle" ? "rounded-full" : "rounded-[10px]";
  const ring = selected
    ? "ring-2 ring-sales-brand ring-offset-2 ring-offset-sales-surface"
    : "ring-1 ring-sales-border";

  const content = showImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src!.trim()}
      alt={alt ?? name}
      className={cn("object-cover object-center", rounded, SIZE_CLASS[size], ring, className)}
      onError={() => setImageFailed(true)}
    />
  ) : initials !== "?" ? (
    <div
      className={cn(
        "flex items-center justify-center font-semibold text-sales-text-primary",
        rounded,
        ring,
        SIZE_CLASS[size],
        className
      )}
      style={{ backgroundColor: getInitialsBackground(name) }}
      aria-hidden={alt ? undefined : true}
      role={alt ? "img" : undefined}
      aria-label={alt}
    >
      {initials}
    </div>
  ) : (
    <div
      className={cn(
        "flex items-center justify-center bg-[var(--sales-neutral-100)] text-sales-text-muted",
        rounded,
        ring,
        SIZE_CLASS[size],
        className
      )}
      aria-hidden={alt ? undefined : true}
      role={alt ? "img" : undefined}
      aria-label={alt}
    >
      <UserRound className="h-[55%] w-[55%]" strokeWidth={1.8} aria-hidden />
    </div>
  );

  if (!presence) return content;

  return (
    <span className={cn("relative inline-flex shrink-0", SIZE_CLASS[size], className)}>
      {content}
      <PresenceIndicator
        state={presence}
        size={PRESENCE_DOT[size]}
        className="absolute bottom-0 right-0"
        showLabel={false}
      />
    </span>
  );
}
