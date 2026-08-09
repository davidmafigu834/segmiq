import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { MarketingThemeProvider } from "@/components/marketing/MarketingThemeProvider";
import MarketingThemeScript from "@/components/marketing/MarketingThemeScript";
import CloudAuthLayout from "@/components/auth/CloudAuthLayout";
import {
  MARKETING_THEME_STORAGE_KEY,
  parseMarketingTheme,
} from "@/lib/marketing/marketing-theme";

export default function CloudAuthShell({
  children,
  formMaxWidthClass,
}: {
  children: ReactNode;
  formMaxWidthClass?: string;
}) {
  const themeCookie = cookies().get(MARKETING_THEME_STORAGE_KEY)?.value;
  const initialTheme = parseMarketingTheme(themeCookie);
  const hasStoredPreference = themeCookie === "light" || themeCookie === "dark";

  return (
    <MarketingThemeProvider
      initialTheme={initialTheme}
      hasStoredPreference={hasStoredPreference}
    >
      <MarketingThemeScript />
      <CloudAuthLayout formMaxWidthClass={formMaxWidthClass}>{children}</CloudAuthLayout>
    </MarketingThemeProvider>
  );
}
