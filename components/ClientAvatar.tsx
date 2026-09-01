"use client";

import { Avatar, type AvatarSize } from "@/components/sales/ui/Avatar";
import { getInitials } from "@/lib/ui/initials";

const LEGACY_SIZE: Record<"sm" | "md" | "lg", AvatarSize> = {
  sm: "xs",
  md: "sm",
  lg: "2xl",
};

/** @deprecated Prefer `Avatar` from `@/components/sales/ui`. */
export function ClientAvatar({
  name,
  size = 32,
  src,
}: {
  name: string;
  size?: number | "sm" | "md" | "lg";
  src?: string | null;
}) {
  let avatarSize: AvatarSize = "md";
  if (typeof size === "string") {
    avatarSize = LEGACY_SIZE[size];
  } else if (size <= 24) avatarSize = "xs";
  else if (size <= 32) avatarSize = "sm";
  else if (size <= 40) avatarSize = "md";
  else if (size <= 48) avatarSize = "lg";
  else if (size <= 56) avatarSize = "xl";
  else avatarSize = "2xl";

  return <Avatar name={name} src={src} size={avatarSize} />;
}

export { getInitials };
