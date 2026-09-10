"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { CrmThemeProvider } from "@/components/CrmThemeProvider";
import { SessionLifecycle } from "@/components/auth/SessionLifecycle";
import { ImpersonationBanner } from "@/components/auth/ImpersonationBanner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
      <CrmThemeProvider>
        <SessionLifecycle />
        <ImpersonationBanner />
        {children}
      </CrmThemeProvider>
    </SessionProvider>
  );
}
