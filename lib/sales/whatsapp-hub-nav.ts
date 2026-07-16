import type { AppShellNavItem } from "@/components/shell/app-shell-types";

export function isWhatsAppSalesHubPath(pathname: string): boolean {
  return (
    pathname === "/sales/inbox"
    || pathname.startsWith("/sales/inbox/")
    || pathname.startsWith("/sales/followups")
    || pathname.startsWith("/sales/reports")
  );
}

export type SalesHubNavBadges = {
  hotLeads?: number;
  needsReply?: number;
  followUpDue?: number;
  followUpsToday?: number;
};

export function buildWhatsAppSalesHubNav(badges?: SalesHubNavBadges): AppShellNavItem {
  return {
    href: "/sales/inbox",
    label: "WhatsApp Sales Hub",
    icon: "message-circle",
    collapsible: true,
    children: [
      {
        href: "/sales/inbox/hot-leads",
        label: "Hot leads",
        icon: "message-circle",
        badge: badges?.hotLeads || undefined,
      },
      {
        href: "/sales/inbox/needs-reply",
        label: "Needs reply",
        icon: "message-circle",
        badge: badges?.needsReply || undefined,
      },
      {
        href: "/sales/inbox/follow-up-due",
        label: "Follow-up due",
        icon: "calendar",
        badge: badges?.followUpDue || undefined,
      },
      {
        href: "/sales/followups",
        label: "Follow-ups",
        icon: "calendar",
        badge: badges?.followUpsToday || undefined,
      },
      { href: "/sales/reports", label: "Reports", icon: "bar-chart-3" },
    ],
  };
}
