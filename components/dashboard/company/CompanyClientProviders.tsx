"use client";

import { type ReactNode } from "react";
import { ToastProvider } from "@/components/sales/ui";

/** Shared client-side providers for /client workspace routes. */
export function CompanyClientProviders({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
