"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** CRM app routes use stronger border tokens (see globals.css `html[data-crm]`). */
function isCrmPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/sales") ||
    pathname.startsWith("/solo") ||
    pathname === "/login" ||
    pathname.startsWith("/onboard") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  );
}

export function CrmThemeScope() {
  const pathname = usePathname();

  useEffect(() => {
    const html = document.documentElement;
    if (isCrmPath(pathname)) {
      html.dataset.crm = "";
    } else {
      delete html.dataset.crm;
    }
  }, [pathname]);

  return null;
}
