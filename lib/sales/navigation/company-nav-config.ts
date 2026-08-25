import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  CalendarDays,
  Columns3,
  CreditCard,
  FileText,
  LayoutDashboard,
  ScanSearch,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";

export type CompanyNavBadgeKey = "whatsapp";

export type CompanyNavIconId =
  | "dashboard"
  | "team"
  | "pipeline"
  | "leads"
  | "whatsapp"
  | "quotations"
  | "calendar"
  | "customers"
  | "agent"
  | "command"
  | "reports"
  | "billing"
  | "settings";

export type CompanyNavSectionId = "company" | "tools";
export type CompanyNavMobileSlot = "primary" | "more";

export type CompanyNavItemConfig = {
  id: string;
  label: string;
  href: string;
  icon: CompanyNavIconId;
  section: CompanyNavSectionId;
  badgeKey?: CompanyNavBadgeKey;
  mobileSlot?: CompanyNavMobileSlot;
  mobileLabel?: string;
  match: (pathname: string) => boolean;
};

/** Match salesperson sidebar width exactly. */
export const COMPANY_SIDEBAR_WIDTH_EXPANDED = 228;
export const COMPANY_SIDEBAR_WIDTH_COLLAPSED = 68;
export const COMPANY_SIDEBAR_COLLAPSED_KEY = "segmiq-company-sidebar-collapsed";

export const COMPANY_NAV_LUCIDE: Record<Exclude<CompanyNavIconId, "whatsapp">, LucideIcon> = {
  dashboard: LayoutDashboard,
  team: Users,
  pipeline: Columns3,
  leads: UsersRound,
  quotations: FileText,
  calendar: CalendarDays,
  customers: UsersRound,
  agent: Bot,
  command: ScanSearch,
  reports: BarChart3,
  billing: CreditCard,
  settings: Settings,
};

function exactOrChild(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Company / Manager navigation — mirrors salesperson sidebar IA.
 */
export const COMPANY_NAVIGATION: CompanyNavItemConfig[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/client/dashboard",
    icon: "dashboard",
    section: "company",
    mobileSlot: "primary",
    mobileLabel: "Dashboard",
    match: (p) => p === "/client/dashboard",
  },
  {
    id: "team",
    label: "Team",
    href: "/client/team",
    icon: "team",
    section: "company",
    mobileSlot: "primary",
    mobileLabel: "Team",
    match: (p) => exactOrChild(p, "/client/team"),
  },
  {
    id: "pipeline",
    label: "Pipeline",
    href: "/client/leads/pipeline",
    icon: "pipeline",
    section: "company",
    mobileSlot: "primary",
    mobileLabel: "Pipeline",
    match: (p) =>
      exactOrChild(p, "/client/leads/pipeline") || exactOrChild(p, "/client/deals"),
  },
  {
    id: "leads",
    label: "Leads",
    href: "/client/leads",
    icon: "leads",
    section: "company",
    mobileSlot: "more",
    mobileLabel: "Leads",
    match: (p) =>
      (p === "/client/leads" || p.startsWith("/client/leads/")) &&
      !p.startsWith("/client/leads/pipeline"),
  },
  {
    id: "whatsapp",
    label: "WhatsApp Sales Hub",
    href: "/client/inbox",
    icon: "whatsapp",
    section: "company",
    badgeKey: "whatsapp",
    mobileSlot: "primary",
    mobileLabel: "WhatsApp",
    match: (p) => exactOrChild(p, "/client/inbox"),
  },
  {
    id: "quotations",
    label: "Quotations",
    href: "/client/quotations",
    icon: "quotations",
    section: "company",
    mobileSlot: "more",
    match: (p) =>
      exactOrChild(p, "/client/quotations") || exactOrChild(p, "/client/quote-settings"),
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/client/calendar",
    icon: "calendar",
    section: "company",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/calendar"),
  },
  {
    id: "customers",
    label: "Customers",
    href: "/client/customers",
    icon: "customers",
    section: "company",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/customers"),
  },
  {
    id: "command",
    label: "Command Center",
    href: "/client/command",
    icon: "command",
    section: "tools",
    mobileSlot: "more",
    mobileLabel: "Command",
    match: (p) => exactOrChild(p, "/client/command"),
  },
  {
    id: "agent",
    label: "SegmiQ Agent",
    href: "/client/agent",
    icon: "agent",
    section: "tools",
    mobileSlot: "more",
    mobileLabel: "Agent",
    match: (p) => exactOrChild(p, "/client/agent"),
  },
  {
    id: "reports",
    label: "Reports",
    href: "/client/reports",
    icon: "reports",
    section: "tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/reports"),
  },
  {
    id: "billing",
    label: "Billing",
    href: "/client/billing",
    icon: "billing",
    section: "tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/billing"),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/client/settings",
    icon: "settings",
    section: "tools",
    mobileSlot: "more",
    match: (p) =>
      exactOrChild(p, "/client/settings") ||
      exactOrChild(p, "/client/account") ||
      exactOrChild(p, "/client/company-profile"),
  },
];

export function companyNavBySection(
  items: CompanyNavItemConfig[],
  section: CompanyNavSectionId
): CompanyNavItemConfig[] {
  return items.filter((i) => i.section === section);
}

export function companyMobilePrimaryItems(
  items: CompanyNavItemConfig[] = COMPANY_NAVIGATION
): CompanyNavItemConfig[] {
  return items.filter((i) => i.mobileSlot === "primary");
}

export function companyMobileMoreItems(
  items: CompanyNavItemConfig[] = COMPANY_NAVIGATION
): CompanyNavItemConfig[] {
  return items.filter((i) => i.mobileSlot === "more");
}

export function companyNameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
