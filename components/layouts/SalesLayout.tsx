import type { ReactNode } from "react";

/**
 * Legacy wrapper — premium sales pages render inside SalesAppShell.
 * Props are kept for existing call sites; only children are rendered.
 */
export function SalesLayout({
  children,
}: {
  children: ReactNode;
  breadcrumb?: string;
  pageTitle?: string;
  actions?: ReactNode;
  hideShellHeader?: boolean;
  hideShellSidebar?: boolean;
  contentFlush?: boolean;
}) {
  return children;
}
