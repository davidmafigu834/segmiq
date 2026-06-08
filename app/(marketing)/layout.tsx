import type { ReactNode } from "react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { MARKETING_GLOW_STYLE } from "@/components/marketing/marketingTheme";

export default function MarketingLayout({ children }: { children: ReactNode }) {
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
