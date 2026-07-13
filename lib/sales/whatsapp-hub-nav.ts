import type { AppShellNavItem } from "@/components/shell/app-shell-types";

export function isWhatsAppSalesHubPath(pathname: string): boolean {
  return (
    pathname === "/sales/inbox"
    || pathname.startsWith("/sales/inbox/")
    || pathname.startsWith("/sales/followups")
    || pathname.startsWith("/sales/reports")
  );
}

export function buildWhatsAppSalesHubNav(followupBadge?: number): AppShellNavItem {
  return {
    href: "/sales/inbox",
    label: "WhatsApp Sales Hub",
    icon: "message-circle",
    children: [
      { href: "/sales/inbox/hot-leads", label: "Hot leads", icon: "message-circle" },
      {
        href: "/sales/followups",
        label: "Follow-ups",
        icon: "calendar",
        badge: followupBadge || undefined,
      },
      { href: "/sales/reports", label: "Reports", icon: "bar-chart-3" },
    ],
  };
}
