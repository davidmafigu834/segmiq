import type { AppShellNavItem } from "@/components/shell/app-shell-types";

export function isWhatsAppSalesHubPath(pathname: string): boolean {
  return pathname === "/sales/inbox" || pathname.startsWith("/sales/inbox/");
}

export type SalesHubNavBadges = {
  hotLeads?: number;
  needsReply?: number;
  followUpDue?: number;
  followUpsToday?: number;
};

export function buildWhatsAppSalesHubNav(badges?: SalesHubNavBadges): AppShellNavItem {
  const count =
    (badges?.hotLeads || 0) + (badges?.needsReply || 0) + (badges?.followUpDue || 0);
  return {
    href: "/sales/inbox",
    label: "WhatsApp Sales Hub",
    icon: "message-circle",
    badge: count || undefined,
  };
}
