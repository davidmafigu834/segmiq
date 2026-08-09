import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  BarChart3,
  Columns3,
  FileText,
  LayoutDashboard,
  ListTodo,
  Target,
  Trophy,
  UsersRound,
  Wrench,
} from "lucide-react";

export type SalesNavBadgeKey = "whatsapp" | "tasks";

export type SalesNavIconId =
  | "dashboard"
  | "pipeline"
  | "whatsapp"
  | "leads"
  | "quotes"
  | "calendar"
  | "tasks"
  | "reports"
  | "wonLost"
  | "goals"
  | "toolbox";

export type SalesNavMobileSlot = "primary" | "more";

export type SalesNavItemConfig = {
  id: string;
  label: string;
  /** Canonical href; dashboard may be rewritten for solo mode */
  href: string;
  icon: SalesNavIconId;
  section: "sales" | "tools";
  badgeKey?: SalesNavBadgeKey;
  /** Bottom nav vs More sheet (mobile) */
  mobileSlot?: SalesNavMobileSlot;
  /** Short label for bottom nav */
  mobileLabel?: string;
  /** Return true when this item should be active for the given pathname */
  match: (pathname: string) => boolean;
};

export const SALES_SIDEBAR_WIDTH_EXPANDED = 228;
export const SALES_SIDEBAR_WIDTH_COLLAPSED = 68;
export const SALES_SIDEBAR_COLLAPSED_KEY = "segmiq-sales-sidebar-collapsed";

/** Lucide icons for non-WhatsApp items (WhatsApp uses SiWhatsapp in the UI). */
export const SALES_NAV_LUCIDE: Record<Exclude<SalesNavIconId, "whatsapp">, LucideIcon> = {
  dashboard: LayoutDashboard,
  pipeline: Columns3,
  leads: UsersRound,
  quotes: FileText,
  calendar: CalendarDays,
  tasks: ListTodo,
  reports: BarChart3,
  wonLost: Trophy,
  goals: Target,
  toolbox: Wrench,
};

function exactOrChild(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Central salesperson navigation.
 * Customers / Help & Support are omitted until real sales routes exist.
 * Event Capture lives in Toolbox — not a permanent Tools row.
 */
export const SALES_NAVIGATION: SalesNavItemConfig[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/sales/dashboard",
    icon: "dashboard",
    section: "sales",
    mobileSlot: "primary",
    mobileLabel: "Dashboard",
    match: (p) => p === "/sales/dashboard" || p === "/solo/dashboard",
  },
  {
    id: "pipeline",
    label: "My Pipeline",
    href: "/sales/leads",
    icon: "pipeline",
    section: "sales",
    mobileSlot: "primary",
    mobileLabel: "Pipeline",
    match: (p) => exactOrChild(p, "/sales/leads"),
  },
  {
    id: "whatsapp",
    label: "WhatsApp Sales Hub",
    href: "/sales/inbox",
    icon: "whatsapp",
    section: "sales",
    badgeKey: "whatsapp",
    mobileSlot: "primary",
    mobileLabel: "WhatsApp",
    match: (p) => p === "/sales/inbox" || p.startsWith("/sales/inbox/"),
  },
  {
    id: "leads",
    label: "Leads",
    href: "/sales/call-now",
    icon: "leads",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/call-now"),
  },
  {
    id: "quotes",
    label: "Quotations",
    href: "/sales/quotes",
    icon: "quotes",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/quotes"),
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/sales/calendar",
    icon: "calendar",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/calendar"),
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/sales/tasks",
    icon: "tasks",
    section: "sales",
    badgeKey: "tasks",
    mobileSlot: "primary",
    mobileLabel: "Tasks",
    match: (p) =>
      exactOrChild(p, "/sales/tasks") ||
      p === "/sales/followups" ||
      p.startsWith("/sales/followups"),
  },
  {
    id: "reports",
    label: "Reports",
    href: "/sales/reports",
    icon: "reports",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/reports"),
  },
  {
    id: "wonLost",
    label: "Won & Lost",
    href: "/sales/won-lost",
    icon: "wonLost",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/won-lost"),
  },
  {
    id: "goals",
    label: "Goals",
    href: "/sales/goals",
    icon: "goals",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/goals"),
  },
  {
    id: "toolbox",
    label: "Toolbox",
    href: "/sales/toolbox",
    icon: "toolbox",
    section: "tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/toolbox"),
  },
];

export const SALES_MOBILE_PRIMARY_IDS = ["dashboard", "pipeline", "whatsapp", "tasks"] as const;

export function salesMobilePrimaryItems(items: SalesNavItemConfig[]): SalesNavItemConfig[] {
  const order = SALES_MOBILE_PRIMARY_IDS as readonly string[];
  return order
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is SalesNavItemConfig => Boolean(i));
}

export function salesMobileMoreItems(items: SalesNavItemConfig[]): SalesNavItemConfig[] {
  return items.filter((i) => i.mobileSlot === "more");
}

export function resolveSalesNavItems(isSolo: boolean): SalesNavItemConfig[] {
  return SALES_NAVIGATION.map((item) => {
    if (item.id === "dashboard") {
      return {
        ...item,
        href: isSolo ? "/solo/dashboard" : "/sales/dashboard",
      };
    }
    return item;
  });
}

export function salesNavItemsBySection(
  items: SalesNavItemConfig[],
  section: "sales" | "tools"
): SalesNavItemConfig[] {
  return items.filter((i) => i.section === section);
}

export function displaySalesName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Sales";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${(parts[1]![0] ?? "").toUpperCase()}.`;
}

export function salesNameInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
