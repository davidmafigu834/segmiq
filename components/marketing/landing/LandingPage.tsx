import { cookies } from "next/headers";
import MarketingNavbar from "@/components/marketing/landing/MarketingNavbar";
import HeroSection from "@/components/marketing/landing/HeroSection";
import TrustedBySection from "@/components/marketing/landing/TrustedBySection";
import PlatformCapabilitiesSection from "@/components/marketing/landing/PlatformCapabilitiesSection";
import HowSegmiQWorksSection from "@/components/marketing/landing/HowSegmiQWorksSection";
import TeamSalesSection from "@/components/marketing/landing/TeamSalesSection";
import WhySegmiQSection from "@/components/marketing/landing/WhySegmiQSection";
import CustomerStorySection from "@/components/marketing/landing/CustomerStorySection";
import FinalCTASection from "@/components/marketing/landing/FinalCTASection";
import LandingFooter from "@/components/marketing/landing/LandingFooter";
import { MarketingThemeProvider } from "@/components/marketing/MarketingThemeProvider";
import MarketingThemeScript from "@/components/marketing/MarketingThemeScript";
import {
  MARKETING_THEME_STORAGE_KEY,
  parseMarketingTheme,
} from "@/lib/marketing/marketing-theme";

/** Homepage — Soft Lime Halo + scoped light/dark marketing theme. */
export default function LandingPage() {
  const themeCookie = cookies().get(MARKETING_THEME_STORAGE_KEY)?.value;
  const initialTheme = parseMarketingTheme(themeCookie);
  const hasStoredPreference = themeCookie === "light" || themeCookie === "dark";

  return (
    <MarketingThemeProvider
      initialTheme={initialTheme}
      hasStoredPreference={hasStoredPreference}
    >
      <MarketingThemeScript />
      <MarketingNavbar />
      <main>
        <HeroSection />
        <TrustedBySection />
        <PlatformCapabilitiesSection />
        <HowSegmiQWorksSection />
        <TeamSalesSection />
        <WhySegmiQSection />
        <CustomerStorySection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </MarketingThemeProvider>
  );
}
