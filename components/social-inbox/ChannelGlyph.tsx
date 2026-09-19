"use client";

import { SiFacebook, SiInstagram } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import { channelNetwork, type SocialChannel } from "@/lib/social-inbox";

export function ChannelGlyph({
  channel,
  size = 12,
  className,
}: {
  channel: SocialChannel;
  size?: number;
  className?: string;
}) {
  const network = channelNetwork(channel);
  if (network === "instagram") {
    return <SiInstagram size={size} className={cn("text-[#E1306C]", className)} aria-hidden />;
  }
  return <SiFacebook size={size} className={cn("text-[#1877F2]", className)} aria-hidden />;
}
