import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Box,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  MessageSquare,
  CreditCard,
  FolderKanban,
  FolderOpen,
  FileText,
  Globe,
  Inbox,
  Handshake,
  Home,
  KeyRound,
  LayoutDashboard,
  Landmark,
  Megaphone,
  Package,
  Radio,
  ScanSearch,
  Search,
  Settings,
  Shield,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
} from "lucide-react";
import { isRealEstate, type BusinessType } from "@/lib/terminology";

export type CompanyNavBadgeKey = "whatsapp";

export type CompanyNavIconId =
  | "dashboard"
  | "team"
  | "documents"
  | "pipeline"
  | "leads"
  | "whatsapp"
  | "socialInbox"
  | "quotations"
  | "projects"
  | "myWork"
  | "calendar"
  | "customers"
  | "agent"
  | "command"
  | "reports"
  | "billing"
  | "settings"
  | "products"
  | "inventory"
  | "packages"
  | "listings"
  | "developments"
  | "opportunities"
  | "owners"
  | "inspections"
  | "mandates"
  | "buyers"
  | "matching"
  | "commissions"
  | "viewings"
  | "offers"
  | "transactions"
  | "marketing"
  | "sources"
  | "website"
  | "compliance"
  | "reviews"
  | "performance"
  | "feedback";

export type CompanyNavSectionId =
  | "company"
  | "products"
  | "tools"
  | "overview"
  | "main"
  | "sales"
  | "marketing"
  | "acquisition"
  | "buyer_sales"
  | "agency"
  | "more_tools"
  | "properties"
  | "team"
  | "compliance"
  | "operations"
  | "system";

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
  documents: FolderOpen,
  pipeline: Columns3,
  leads: UsersRound,
  socialInbox: Inbox,
  quotations: FileText,
  projects: FolderKanban,
  myWork: ClipboardCheck,
  calendar: CalendarDays,
  customers: UsersRound,
  agent: Bot,
  command: ScanSearch,
  reports: BarChart3,
  billing: CreditCard,
  settings: Settings,
  products: Box,
  inventory: Warehouse,
  packages: Package,
  listings: Building2,
  opportunities: Home,
  owners: UserRound,
  inspections: ClipboardList,
  mandates: KeyRound,
  buyers: UsersRound,
  matching: Search,
  commissions: Wallet,
  developments: Landmark,
  viewings: CalendarCheck,
  offers: Handshake,
  transactions: Landmark,
  marketing: Megaphone,
  sources: Radio,
  website: Globe,
  compliance: Shield,
  reviews: ClipboardCheck,
  performance: Trophy,
  feedback: MessageSquare,
};

export const COMPANY_NAV_SECTION_LABEL: Record<CompanyNavSectionId, string> = {
  company: "Company",
  products: "Products",
  tools: "Tools",
  overview: "Overview",
  main: "Main",
  sales: "Sales",
  marketing: "Marketing",
  acquisition: "Property acquisition",
  buyer_sales: "Buyer and tenant sales",
  agency: "Agency operations",
  more_tools: "More tools",
  properties: "Properties",
  team: "Team",
  compliance: "Compliance",
  operations: "Operations",
  system: "System",
};

export const COMPANY_NAV_SECTION_ORDER: Record<BusinessType, CompanyNavSectionId[]> = {
  trades: ["company", "products", "tools"],
  real_estate: [
    "main",
    "acquisition",
    "buyer_sales",
    "agency",
    "more_tools",
    "system",
  ],
};

function exactOrChild(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Company / Manager navigation — trades information architecture.
 * Mirrors salesperson sidebar IA. Do not change for real_estate; use REAL_ESTATE_COMPANY_NAVIGATION.
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
    id: "documents",
    label: "Documents",
    href: "/client/documents",
    icon: "documents",
    section: "company",
    mobileSlot: "more",
    mobileLabel: "Documents",
    match: (p) => exactOrChild(p, "/client/documents"),
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
    id: "socialInbox",
    label: "Social Inbox",
    href: "/client/social-inbox",
    icon: "socialInbox",
    section: "company",
    mobileSlot: "more",
    mobileLabel: "Social",
    match: (p) => exactOrChild(p, "/client/social-inbox"),
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
    id: "projects",
    label: "Projects",
    href: "/client/projects",
    icon: "projects",
    section: "company",
    mobileSlot: "more",
    mobileLabel: "Projects",
    match: (p) => exactOrChild(p, "/client/projects"),
  },
  {
    id: "myWork",
    label: "My work",
    href: "/client/work",
    icon: "myWork",
    section: "company",
    mobileSlot: "more",
    mobileLabel: "My work",
    match: (p) => exactOrChild(p, "/client/work"),
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
    id: "products",
    label: "Products",
    href: "/client/products",
    icon: "products",
    section: "products",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/products"),
  },
  {
    id: "inventory",
    label: "Inventory",
    href: "/client/inventory",
    icon: "inventory",
    section: "products",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/inventory"),
  },
  {
    id: "packages",
    label: "Packages",
    href: "/client/packages",
    icon: "packages",
    section: "products",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/packages"),
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

/**
 * Real-estate company IA. Products / Inventory / Packages / Quotations are
 * intentionally omitted from first-class navigation (routes remain valid).
 */
export const REAL_ESTATE_COMPANY_NAVIGATION: CompanyNavItemConfig[] = [
  {
    id: "overview",
    label: "Dashboard",
    href: "/client/dashboard",
    icon: "dashboard",
    section: "main",
    mobileSlot: "primary",
    mobileLabel: "Home",
    match: (p) => p === "/client/dashboard",
  },
  {
    id: "inquiries",
    label: "Inquiries",
    href: "/client/leads",
    icon: "leads",
    section: "more_tools",
    mobileSlot: "more",
    mobileLabel: "Inquiries",
    match: (p) =>
      (p === "/client/leads" || p.startsWith("/client/leads/")) &&
      !p.startsWith("/client/leads/pipeline") &&
      !p.startsWith("/client/marketing"),
  },
  {
    id: "pipeline",
    label: "Pipeline",
    href: "/client/leads/pipeline",
    icon: "pipeline",
    section: "more_tools",
    mobileSlot: "more",
    mobileLabel: "Pipeline",
    match: (p) =>
      exactOrChild(p, "/client/leads/pipeline") || exactOrChild(p, "/client/deals"),
  },
  {
    id: "offers",
    label: "Offers & Deals",
    href: "/client/offers",
    icon: "offers",
    section: "buyer_sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/offers"),
  },
  {
    id: "transactions",
    label: "Transactions",
    href: "/client/transactions",
    icon: "transactions",
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/transactions"),
  },
  {
    id: "viewings",
    label: "Viewings",
    href: "/client/viewings",
    icon: "viewings",
    section: "buyer_sales",
    mobileSlot: "more",
    mobileLabel: "Viewings",
    match: (p) => exactOrChild(p, "/client/viewings"),
  },
  {
    id: "whatsapp",
    label: "Sales Inbox",
    href: "/client/inbox",
    icon: "whatsapp",
    section: "main",
    badgeKey: "whatsapp",
    mobileSlot: "primary",
    mobileLabel: "Inbox",
    match: (p) => exactOrChild(p, "/client/inbox"),
  },
  {
    id: "socialInbox",
    label: "Social Inbox",
    href: "/client/social-inbox",
    icon: "socialInbox",
    section: "more_tools",
    mobileSlot: "more",
    mobileLabel: "Social",
    match: (p) => exactOrChild(p, "/client/social-inbox"),
  },
  {
    id: "marketing",
    label: "Marketing",
    href: "/client/marketing",
    icon: "marketing",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) =>
      p === "/client/marketing" ||
      (p.startsWith("/client/marketing/") &&
        !p.startsWith("/client/marketing/sources") &&
        !p.startsWith("/client/marketing/website-leads")),
  },
  {
    id: "lead-sources",
    label: "Lead Sources",
    href: "/client/marketing/sources",
    icon: "sources",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/marketing/sources"),
  },
  {
    id: "website-leads",
    label: "Website Leads",
    href: "/client/marketing/website-leads",
    icon: "website",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/marketing/website-leads"),
  },
  {
    id: "buyers",
    label: "Buyers & Tenants",
    href: "/client/buyers",
    icon: "buyers",
    section: "buyer_sales",
    mobileSlot: "more",
    mobileLabel: "Buyers",
    match: (p) => exactOrChild(p, "/client/buyers"),
  },
  {
    id: "matching",
    label: "Property Matching",
    href: "/client/matching",
    icon: "matching",
    section: "buyer_sales",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/matching"),
  },
  {
    id: "opportunities",
    label: "Property Opportunities",
    href: "/client/acquisitions",
    icon: "opportunities",
    section: "acquisition",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/acquisitions"),
  },
  {
    id: "owners",
    label: "Property Owners",
    href: "/client/owners",
    icon: "owners",
    section: "acquisition",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/owners"),
  },
  {
    id: "inspections",
    label: "Inspections",
    href: "/client/inspections",
    icon: "inspections",
    section: "acquisition",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/inspections"),
  },
  {
    id: "mandates",
    label: "Mandates",
    href: "/client/mandates",
    icon: "mandates",
    section: "acquisition",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/mandates"),
  },
  {
    id: "listings",
    label: "Property Listings",
    href: "/client/listings",
    icon: "listings",
    section: "agency",
    mobileSlot: "primary",
    mobileLabel: "Properties",
    match: (p) => exactOrChild(p, "/client/listings"),
  },
  {
    id: "developments",
    label: "Developments",
    href: "/client/developments",
    icon: "developments",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/developments"),
  },
  {
    id: "agents",
    label: "Team Management",
    href: "/client/team",
    icon: "team",
    section: "agency",
    mobileSlot: "more",
    match: (p) =>
      (exactOrChild(p, "/client/team") && !p.startsWith("/client/agents")) ||
      exactOrChild(p, "/client/agency/team"),
  },
  {
    id: "agent-performance",
    label: "Agent Performance",
    href: "/client/agents/performance",
    icon: "performance",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/agents/performance"),
  },
  {
    id: "compliance",
    label: "Compliance Cases",
    href: "/client/compliance",
    icon: "compliance",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => p === "/client/compliance",
  },
  {
    id: "reviews",
    label: "Reviews",
    href: "/client/compliance/reviews",
    icon: "reviews",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/compliance/reviews"),
  },
  {
    id: "documents",
    label: "Documents",
    href: "/client/documents",
    icon: "documents",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/documents"),
  },
  {
    id: "calendar",
    label: "My Activities",
    href: "/client/calendar",
    icon: "calendar",
    section: "main",
    mobileSlot: "primary",
    mobileLabel: "Activities",
    match: (p) => exactOrChild(p, "/client/calendar"),
  },
  {
    id: "commissions",
    label: "Commissions",
    href: "/client/commissions",
    icon: "commissions",
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/commissions"),
  },
  {
    id: "reports",
    label: "Reports & Analytics",
    href: "/client/reports",
    icon: "reports",
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/reports"),
  },
  {
    id: "feedback",
    label: "Feedback",
    href: "/client/feedback",
    icon: "feedback",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/feedback"),
  },
  {
    id: "customers",
    label: "Customers",
    href: "/client/customers",
    icon: "customers",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/customers"),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/client/settings",
    icon: "settings",
    section: "system",
    mobileSlot: "more",
    match: (p) =>
      exactOrChild(p, "/client/settings") ||
      exactOrChild(p, "/client/account") ||
      exactOrChild(p, "/client/company-profile"),
  },
  {
    id: "billing",
    label: "Billing",
    href: "/client/billing",
    icon: "billing",
    section: "system",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/billing"),
  },
];

const SOLAR_COMPANY_NAV_IDS = new Set(["projects", "myWork"]);

export function getCompanyNavigation(
  businessType?: BusinessType | string | null,
  options?: { solarWorkflow?: boolean }
): CompanyNavItemConfig[] {
  const nav = isRealEstate(businessType) ? REAL_ESTATE_COMPANY_NAVIGATION : COMPANY_NAVIGATION;
  if (options?.solarWorkflow) return nav;
  return nav.filter((item) => !SOLAR_COMPANY_NAV_IDS.has(item.id));
}

export function getCompanyNavSectionOrder(
  businessType?: BusinessType | string | null
): CompanyNavSectionId[] {
  return isRealEstate(businessType)
    ? COMPANY_NAV_SECTION_ORDER.real_estate
    : COMPANY_NAV_SECTION_ORDER.trades;
}

export function companyNavHasTradesCatalog(
  items: CompanyNavItemConfig[] = COMPANY_NAVIGATION
): boolean {
  return items.some((i) => i.id === "products" || i.id === "inventory" || i.id === "packages");
}

export function companyNavHasRealEstateProperties(
  items: CompanyNavItemConfig[]
): boolean {
  return items.some((i) => i.id === "listings") && items.some((i) => i.id === "developments");
}

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
