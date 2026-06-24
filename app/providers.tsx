"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { CrmThemeScope } from "@/components/CrmThemeScope";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CrmThemeScope />
      {children}
    </SessionProvider>
  );
}
