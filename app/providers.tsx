"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { CrmThemeProvider } from "@/components/CrmThemeProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CrmThemeProvider>{children}</CrmThemeProvider>
    </SessionProvider>
  );
}
