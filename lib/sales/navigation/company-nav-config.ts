import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Columns3,
  CreditCard,
  FileText,
  LayoutDashboard,
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
  | "customers"
  | "reports"
  | "billing"
  | "settings";

export type CompanyNavItemConfig = {
  id: string;
  label: string;
  href: string;
  icon: CompanyNavIconId;
  badgeKey?: CompanyNavBadgeKey;
  match: (pathname: string) => boolean;
};

export const COMPANY_SIDEBAR_WIDTH_EXPANDED = 240;
export const COMPANY_SIDEBAR_WIDTH_COLLAPSED = 68;
export const COMPANY_SIDEBAR_COLLAPSED_KEY = "segmiq-company-sidebar-collapsed";

export const COMPANY_NAV_LUCIDE: Record<Exclude<CompanyNavIconId, "whatsapp">, LucideIcon> = {
  dashboard: LayoutDashboard,
  team: Users,
  pipeline: Columns3,
  leads: UsersRound,
  quotations: FileText,
  customers: UsersRound,
  reports: BarChart3,
  billing: CreditCard,
  settings: Settings,
};

function exactOrChild(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Company / Manager navigation — only routes that exist.
 * Calendar & Tasks omitted until company-scoped pages ship.
 */
export const COMPANY_NAVIGATION: CompanyNavItemConfig[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/client/dashboard",
    icon: "dashboard",
    match: (p) => p === "/client/dashboard",
  },
  {
    id: "team",
    label: "Team",
    href: "/client/team",
    icon: "team",
    match: (p) => exactOrChild(p, "/client/team"),
  },
  {
    id: "pipeline",
    label: "Pipeline",
    href: "/client/leads/pipeline",
    icon: "pipeline",
    match: (p) => exactOrChild(p, "/client/leads/pipeline"),
  },
  {
    id: "leads",
    label: "Leads",
    href: "/client/leads",
    icon: "leads",
    match: (p) =>
      (p === "/client/leads" || p.startsWith("/client/leads/")) &&
      !p.startsWith("/client/leads/pipeline"),
  },
  {
    id: "whatsapp",
    label: "WhatsApp Sales Hub",
    href: "/client/inbox",
    icon: "whatsapp",
    badgeKey: "whatsapp",
    match: (p) => exactOrChild(p, "/client/inbox"),
  },
  {
    id: "quotations",
    label: "Quotations",
    href: "/client/quote-settings",
    icon: "quotations",
    match: (p) => exactOrChild(p, "/client/quote-settings"),
  },
  {
    id: "customers",
    label: "Customers",
    href: "/client/customers",
    icon: "customers",
    match: (p) => exactOrChild(p, "/client/customers"),
  },
  {
    id: "reports",
    label: "Reports",
    href: "/client/reports",
    icon: "reports",
    match: (p) => exactOrChild(p, "/client/reports"),
  },
  {
    id: "billing",
    label: "Billing",
    href: "/client/billing",
    icon: "billing",
    match: (p) => exactOrChild(p, "/client/billing"),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/client/account",
    icon: "settings",
    match: (p) =>
      exactOrChild(p, "/client/account") || exactOrChild(p, "/client/company-profile"),
  },
];

export function companyNameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
