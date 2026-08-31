"use client";

import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";

export function BrandIcon({
  brand,
  size = 16,
  className,
}: {
  brand: "whatsapp" | "facebook";
  size?: number;
  className?: string;
}) {
  if (brand === "whatsapp") {
    return (
      <SiWhatsapp
        size={size}
        color="#25D366"
        className={cn(className)}
        aria-hidden
      />
    );
  }
  return (
    <SiFacebook size={size} color="#1877F2" className={cn(className)} aria-hidden />
  );
}

export { Tooltip } from "./Tooltip";
