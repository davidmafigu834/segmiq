"use client";

import { initials } from "@/lib/inbox/assignee-colors";

const AVATAR_COLORS = [
  "#00A884",
  "#53BDEB",
  "#E5425C",
  "#9B59B6",
  "#E67E22",
  "#3498DB",
  "#1ABC9C",
  "#E91E63",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

type Props = {
  name: string | null | undefined;
  phone?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-10 w-10 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-14 w-14 text-base",
};

export function WhatsAppAvatar({ name, phone, imageUrl, size = "sm", className = "" }: Props) {
  const label = name?.trim() || phone || "Contact";
  const seed = phone?.replace(/\D/g, "") || label;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={label}
        className={`rounded-full object-cover ${SIZE_CLASS[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white shadow-sm ${SIZE_CLASS[size]} ${className}`}
      style={{ backgroundColor: avatarColor(seed) }}
      aria-hidden
    >
      {initials(label)}
    </div>
  );
}

export function displayContactName(conversation: {
  name?: string | null;
  whatsappProfileName?: string | null;
  phone?: string | null;
}): string {
  return (
    conversation.name?.trim()
    || conversation.whatsappProfileName?.trim()
    || conversation.phone?.trim()
    || "Unknown"
  );
}
