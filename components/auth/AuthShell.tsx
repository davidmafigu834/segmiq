import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { MarketingThemeProvider } from "@/components/marketing/MarketingThemeProvider";
import MarketingThemeScript from "@/components/marketing/MarketingThemeScript";
import AuthLayout from "@/components/auth/AuthLayout";
import type { AuthMarketingVariant } from "@/components/auth/AuthMarketingPanel";
import {
  MARKETING_THEME_STORAGE_KEY,
  parseMarketingTheme,
} from "@/lib/marketing/marketing-theme";

/** Server wrapper: shared marketing theme + AuthLayout for CRM public auth. */
export default function AuthShell({
  variant,
  children,
  formMaxWidthClass,
}: {
  variant: AuthMarketingVariant;
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
      <AuthLayout variant={variant} formMaxWidthClass={formMaxWidthClass}>
        {children}
      </AuthLayout>
    </MarketingThemeProvider>
  );
}
