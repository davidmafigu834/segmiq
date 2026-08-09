"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { MARKETING_GLOW_STYLE } from "@/components/marketing/marketingTheme";

/** Homepage uses its own light navbar/hero; other marketing pages keep the dark shell. */
export default function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  /* Homepage owns its chrome + MarketingThemeProvider; do not force light shell. */
  if (isHome) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen bg-black text-white antialiased font-sans">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={MARKETING_GLOW_STYLE}
      />
      <div className="relative z-10">
        <MarketingHeader />
        <main>{children}</main>
        <MarketingFooter />
      </div>
    </div>
  );
}
