import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  CalendarDays,
  BarChart3,
  Building2,
  ClipboardList,
  Columns3,
  FileText,
  FolderKanban,
  KeyRound,
  Handshake,
  Home,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Search,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  Wallet,
  Wrench,
} from "lucide-react";
import { isRealEstate, type BusinessType } from "@/lib/terminology";

export type SalesNavBadgeKey = "whatsapp" | "tasks";

export type SalesNavIconId =
  | "dashboard"
  | "pipeline"
  | "whatsapp"
  | "socialInbox"
  | "leads"
  | "quotes"
  | "projects"
  | "myWork"
  | "calendar"
  | "tasks"
  | "command"
  | "reports"
  | "wonLost"
  | "goals"
  | "toolbox"
  | "listings"
  | "offers"
  | "transactions"
  | "opportunities"
  | "owners"
  | "inspections"
  | "mandates"
  | "buyers"
  | "matching"
  | "viewings"
  | "commissions";

export type SalesNavMobileSlot = "primary" | "more";

export type SalesNavSectionId =
  | "sales"
  | "tools"
  | "main"
  | "acquisition"
  | "buyer_sales"
  | "agency"
  | "more_tools"
  | "system";

export type SalesNavItemConfig = {
  id: string;
  label: string;
  /** Canonical href; dashboard may be rewritten for solo mode */
  href: string;
  icon: SalesNavIconId;
  section: SalesNavSectionId;
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
  socialInbox: Inbox,
  leads: UsersRound,
  quotes: FileText,
  projects: FolderKanban,
  myWork: ListTodo,
  calendar: CalendarDays,
  tasks: ListTodo,
  command: MessageSquare,
  reports: BarChart3,
  wonLost: Trophy,
  goals: Target,
  toolbox: Wrench,
  listings: Building2,
  opportunities: Home,
  owners: UserRound,
  inspections: ClipboardList,
  mandates: KeyRound,
  buyers: UsersRound,
  matching: Search,
  viewings: CalendarCheck,
  commissions: Wallet,
  offers: Handshake,
  transactions: Landmark,
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
    href: "/sales/pipeline",
    icon: "pipeline",
    section: "sales",
    mobileSlot: "primary",
    mobileLabel: "Pipeline",
    match: (p) =>
      exactOrChild(p, "/sales/pipeline") || exactOrChild(p, "/sales/deals"),
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
    id: "socialInbox",
    label: "Social Inbox",
    href: "/sales/social-inbox",
    icon: "socialInbox",
    section: "sales",
    mobileSlot: "more",
    mobileLabel: "Social",
    match: (p) => exactOrChild(p, "/sales/social-inbox"),
  },
  {
    id: "leads",
    label: "Leads",
    href: "/sales/leads",
    icon: "leads",
    section: "sales",
    mobileSlot: "more",
    match: (p) =>
      exactOrChild(p, "/sales/leads") || exactOrChild(p, "/sales/call-now"),
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
    id: "projects",
    label: "Projects",
    href: "/sales/projects",
    icon: "projects",
    section: "sales",
    mobileSlot: "more",
    mobileLabel: "Projects",
    match: (p) => exactOrChild(p, "/sales/projects"),
  },
  {
    id: "myWork",
    label: "My work",
    href: "/sales/work",
    icon: "myWork",
    section: "sales",
    mobileSlot: "more",
    mobileLabel: "My work",
    match: (p) => exactOrChild(p, "/sales/work"),
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
    id: "command",
    label: "Command",
    href: "/sales/command",
    icon: "command",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/command"),
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

export function salesMobilePrimaryItems(
  items: SalesNavItemConfig[],
  businessType?: BusinessType | string | null
): SalesNavItemConfig[] {
  const order = isRealEstate(businessType)
    ? (["dashboard", "whatsapp", "listings", "tasks"] as const)
    : SALES_MOBILE_PRIMARY_IDS;
  return order
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is SalesNavItemConfig => Boolean(i));
}

export function salesMobileMoreItems(items: SalesNavItemConfig[]): SalesNavItemConfig[] {
  return items.filter((i) => i.mobileSlot === "more");
}

function withoutSolarDelivery(items: SalesNavItemConfig[], solarWorkflow?: boolean): SalesNavItemConfig[] {
  if (solarWorkflow) return items;
  return items.filter((item) => item.id !== "projects" && item.id !== "myWork");
}

export function resolveSalesNavItems(
  isSolo: boolean,
  businessType?: BusinessType | string | null,
  options?: { solarWorkflow?: boolean }
): SalesNavItemConfig[] {
  const items = SALES_NAVIGATION.map((item) => {
    if (item.id === "dashboard") {
      return {
        ...item,
        href: isSolo ? "/solo/dashboard" : "/sales/dashboard",
      };
    }
    return item;
  });
  if (!isRealEstate(businessType)) return withoutSolarDelivery(items, options?.solarWorkflow);
  const buyerItems: SalesNavItemConfig[] = [
    {
      id: "buyers",
      label: "Buyers & Tenants",
      href: "/sales/buyers",
      icon: "buyers",
      section: "sales",
      mobileSlot: "more",
      mobileLabel: "Buyers",
      match: (p) => exactOrChild(p, "/sales/buyers"),
    },
    {
      id: "matching",
      label: "Property Matching",
      href: "/sales/matching",
      icon: "matching",
      section: "sales",
      mobileSlot: "more",
      match: (p) => exactOrChild(p, "/sales/matching"),
    },
    {
      id: "viewings",
      label: "Viewings",
      href: "/sales/viewings",
      icon: "viewings",
      section: "sales",
      mobileSlot: "more",
      match: (p) => exactOrChild(p, "/sales/viewings"),
    },
  ];
  const acquisitionItems: SalesNavItemConfig[] = [
    {
      id: "opportunities",
      label: "Property Opportunities",
      href: "/sales/acquisitions",
      icon: "opportunities",
      section: "sales",
      mobileSlot: "more",
      match: (p) => exactOrChild(p, "/sales/acquisitions"),
    },
    {
      id: "owners",
      label: "Property Owners",
      href: "/sales/owners",
      icon: "owners",
      section: "sales",
      mobileSlot: "more",
      match: (p) => exactOrChild(p, "/sales/owners"),
    },
    {
      id: "inspections",
      label: "Inspections",
      href: "/sales/inspections",
      icon: "inspections",
      section: "sales",
      mobileSlot: "more",
      match: (p) => exactOrChild(p, "/sales/inspections"),
    },
    {
      id: "mandates",
      label: "Mandates",
      href: "/sales/mandates",
      icon: "mandates",
      section: "sales",
      mobileSlot: "more",
      match: (p) => exactOrChild(p, "/sales/mandates"),
    },
  ];
  const listingsItem: SalesNavItemConfig = {
    id: "listings",
    label: "Property Listings",
    href: "/sales/listings",
    icon: "listings",
    section: "sales",
    mobileSlot: "primary",
    mobileLabel: "Properties",
    match: (p) => exactOrChild(p, "/sales/listings"),
  };
  const offersItem: SalesNavItemConfig = {
    id: "offers",
      label: "Offers & Deals",
    href: "/sales/offers",
    icon: "offers",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/offers"),
  };
  const transactionsItem: SalesNavItemConfig = {
    id: "transactions",
      label: "My Transactions",
    href: "/sales/transactions",
    icon: "transactions",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/transactions"),
  };
  const commissionsItem: SalesNavItemConfig = {
    id: "commissions",
    label: "My Commissions",
    href: "/sales/commissions",
    icon: "commissions",
    section: "sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/sales/commissions"),
  };
  return items.flatMap((item) => {
    if (item.id === "quotes") return [];
    if (item.id === "projects" || item.id === "myWork") return [];
    if (item.id === "leads") {
      return [
        { ...item, label: "Inquiries" },
        ...buyerItems,
        ...acquisitionItems,
        listingsItem,
        offersItem,
        transactionsItem,
        commissionsItem,
      ];
    }
    return [item];
  }).map((item) => {
    const section = REAL_ESTATE_AGENT_SECTIONS[item.id] ?? item.section;
    const label = REAL_ESTATE_AGENT_LABELS[item.id];
    return {
      ...item,
      section,
      ...(label ? { label: label.label, mobileLabel: label.mobileLabel } : {}),
    };
  });
}

const REAL_ESTATE_AGENT_SECTIONS: Record<string, SalesNavSectionId> = {
  dashboard: "main",
  whatsapp: "main",
  tasks: "main",
  opportunities: "acquisition",
  owners: "acquisition",
  inspections: "acquisition",
  mandates: "acquisition",
  buyers: "buyer_sales",
  matching: "buyer_sales",
  viewings: "buyer_sales",
  offers: "buyer_sales",
  listings: "agency",
  transactions: "agency",
  commissions: "agency",
  pipeline: "more_tools",
  socialInbox: "more_tools",
  leads: "more_tools",
  calendar: "more_tools",
  command: "more_tools",
  reports: "more_tools",
  wonLost: "more_tools",
  goals: "more_tools",
  toolbox: "system",
};

const REAL_ESTATE_AGENT_LABELS: Record<string, { label: string; mobileLabel: string }> = {
  dashboard: { label: "Dashboard", mobileLabel: "Home" },
  whatsapp: { label: "Sales Inbox", mobileLabel: "Inbox" },
  tasks: { label: "My Activities", mobileLabel: "Activities" },
};

export const REAL_ESTATE_SALES_SECTION_ORDER: SalesNavSectionId[] = [
  "main",
  "acquisition",
  "buyer_sales",
  "agency",
  "more_tools",
  "system",
];

export const SALES_NAV_SECTION_LABEL: Record<SalesNavSectionId, string> = {
  sales: "Sales",
  tools: "Tools",
  main: "Main",
  acquisition: "Property acquisition",
  buyer_sales: "Buyer & tenant sales",
  agency: "Agency operations",
  more_tools: "More tools",
  system: "System",
};

export function salesNavItemsBySection(
  items: SalesNavItemConfig[],
  section: SalesNavSectionId
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
