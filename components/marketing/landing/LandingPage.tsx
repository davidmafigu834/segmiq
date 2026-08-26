import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import MarketingNavbar from "@/components/marketing/landing/MarketingNavbar";
import HeroSection from "@/components/marketing/landing/HeroSection";
import TrustedBySection from "@/components/marketing/landing/TrustedBySection";
import AgenticAISection from "@/components/marketing/landing/AgenticAISection";
import CompanyBrainSection from "@/components/marketing/landing/CompanyBrainSection";
import HowSegmiQWorksSection from "@/components/marketing/landing/HowSegmiQWorksSection";
import PlatformCapabilitiesSection from "@/components/marketing/landing/PlatformCapabilitiesSection";
import TeamSalesSection from "@/components/marketing/landing/TeamSalesSection";
import WhySegmiQSection from "@/components/marketing/landing/WhySegmiQSection";
import CustomerStorySection from "@/components/marketing/landing/CustomerStorySection";
import FinalCTASection from "@/components/marketing/landing/FinalCTASection";
import LandingFooter from "@/components/marketing/landing/LandingFooter";
import SegmiQAtmosphere from "@/components/marketing/landing/SegmiQAtmosphere";
import { MarketingThemeProvider } from "@/components/marketing/MarketingThemeProvider";
import MarketingThemeScript from "@/components/marketing/MarketingThemeScript";
import {
  MARKETING_THEME_STORAGE_KEY,
  parseMarketingTheme,
} from "@/lib/marketing/marketing-theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Homepage — official SegmiQ navy / indigo / violet atmosphere. */
export default function LandingPage() {
  const themeCookie = cookies().get(MARKETING_THEME_STORAGE_KEY)?.value;
  const hasStoredPreference = themeCookie === "light" || themeCookie === "dark";
  const initialTheme = hasStoredPreference ? parseMarketingTheme(themeCookie) : "dark";

  return (
    <MarketingThemeProvider
      initialTheme={initialTheme}
      hasStoredPreference={hasStoredPreference}
      pageClassName={`segmiq-landing ${inter.variable}`}
      fallbackTheme="dark"
    >
      <MarketingThemeScript fallback="dark" />
      <SegmiQAtmosphere />
      <MarketingNavbar />
      <main>
        <HeroSection />
        <TrustedBySection />
        <AgenticAISection />
        <CompanyBrainSection />
        <HowSegmiQWorksSection />
        <PlatformCapabilitiesSection />
        <TeamSalesSection />
        <WhySegmiQSection />
        <CustomerStorySection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </MarketingThemeProvider>
  );
}
