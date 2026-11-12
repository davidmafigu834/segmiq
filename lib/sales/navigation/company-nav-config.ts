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
  ShieldCheck,
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
  | "dueDiligence"
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
  | "follow_up"
  | "properties"
  | "team"
  | "compliance"
  | "operations"
  | "customers"
  | "intelligence"
  | "management"
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
  /** Highlights this destination while a related compatibility route is open. */
  activeOn?: (pathname: string) => boolean;
};

export function companyNavIsActive(item: CompanyNavItemConfig, pathname: string): boolean {
  return (item.activeOn ?? item.match)(pathname);
}

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
  dueDiligence: ShieldCheck,
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
  agency: "Agency tools",
  more_tools: "More tools",
  follow_up: "Follow-up",
  properties: "Properties",
  team: "Team",
  compliance: "Compliance",
  operations: "Operations",
  customers: "Customers",
  intelligence: "Intelligence",
  management: "Management",
  system: "System",
};

export const COMPANY_NAV_SECTION_ORDER: Record<BusinessType, CompanyNavSectionId[]> = {
  trades: ["company", "products", "tools"],
  real_estate: ["main", "acquisition", "buyer_sales", "agency"],
};

function exactOrChild(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function covers(pathname: string, hrefs: readonly string[]): boolean {
  return hrefs.some((href) => exactOrChild(pathname, href));
}

const REAL_ESTATE_COMPANY_ACTIVE_ON: Partial<Record<string, (pathname: string) => boolean>> = {
  listings: (pathname) => covers(pathname, ["/client/listings", "/client/acquisitions", "/client/matching"]),
  review: (pathname) => covers(pathname, ["/client/review", "/client/compliance"]),
  transactions: (pathname) => covers(pathname, ["/client/transactions"]),
};

const REAL_ESTATE_COMPANY_ITEM_ORDER: Partial<Record<CompanyNavSectionId, string[]>> = {
  main: ["overview", "listings", "calendar", "transactions", "review", "whatsapp", "socialInbox"],
  acquisition: ["mandates", "dueDiligence", "owners", "inspections"],
  buyer_sales: ["inquiries", "buyers", "viewings", "offers", "marketing"],
  agency: [
    "agents",
    "commissions",
    "reports",
    "lead-sources",
    "listing-pages",
    "website-leads",
    "developments",
    "documents",
    "customers",
    "feedback",
    "agent-performance",
    "settings",
    "billing",
  ],
};

function presentRealEstateCompanyNavigation(items: CompanyNavItemConfig[]): CompanyNavItemConfig[] {
  const sectionRank = new Map(COMPANY_NAV_SECTION_ORDER.real_estate.map((id, index) => [id, index]));
  const itemRank = new Map<string, number>();
  COMPANY_NAV_SECTION_ORDER.real_estate.forEach((section) => {
    (REAL_ESTATE_COMPANY_ITEM_ORDER[section] ?? []).forEach((id, index) => itemRank.set(id, index));
  });
  return [...items]
    .map((item) => {
      const activeOn = REAL_ESTATE_COMPANY_ACTIVE_ON[item.id];
      return activeOn ? { ...item, activeOn } : item;
    })
    .sort((a, b) => {
      const sectionDelta = (sectionRank.get(a.section) ?? 50) - (sectionRank.get(b.section) ?? 50);
      if (sectionDelta !== 0) return sectionDelta;
      return (itemRank.get(a.id) ?? 50) - (itemRank.get(b.id) ?? 50);
    });
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
    label: "Today",
    href: "/client/dashboard",
    icon: "dashboard",
    section: "main",
    mobileSlot: "primary",
    mobileLabel: "Today",
    match: (p) => p === "/client/dashboard",
  },
  {
    id: "inquiries",
    label: "Inquiries",
    href: "/client/leads",
    icon: "leads",
    section: "buyer_sales",
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
    label: "Offers",
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
    section: "main",
    mobileSlot: "primary",
    mobileLabel: "Transactions",
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
    mobileSlot: "more",
    mobileLabel: "Inbox",
    match: (p) => exactOrChild(p, "/client/inbox"),
  },
  {
    id: "socialInbox",
    label: "Social Inbox",
    href: "/client/social-inbox",
    icon: "socialInbox",
    section: "main",
    mobileSlot: "more",
    mobileLabel: "Social",
    match: (p) => exactOrChild(p, "/client/social-inbox"),
  },
  {
    id: "marketing",
    label: "Marketing",
    href: "/client/marketing",
    icon: "marketing",
    section: "buyer_sales",
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
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/marketing/sources"),
  },
  {
    id: "listing-pages",
    label: "Listing pages",
    href: "/client/listing-pages",
    icon: "marketing",
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/listing-pages"),
  },
  {
    id: "website-leads",
    label: "Website Leads",
    href: "/client/marketing/website-leads",
    icon: "website",
    section: "agency",
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
    match: (p) => exactOrChild(p, "/client/buyers") && !p.startsWith("/client/buyers/introductions"),
  },
  {
    id: "introductions",
    label: "Introductions",
    href: "/client/buyers/introductions",
    icon: "buyers",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/buyers/introductions"),
  },
  {
    id: "matching",
    label: "Property Matching",
    href: "/client/matching",
    icon: "matching",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/matching"),
  },
  {
    id: "opportunities",
    label: "Property Opportunities",
    href: "/client/acquisitions",
    icon: "opportunities",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/acquisitions"),
  },
  {
    id: "owners",
    label: "Sellers",
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
    id: "dueDiligence",
    label: "Due diligence",
    href: "/client/due-diligence",
    icon: "dueDiligence",
    section: "acquisition",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/due-diligence"),
  },
  {
    id: "listings",
    label: "Properties",
    href: "/client/listings",
    icon: "listings",
    section: "main",
    mobileSlot: "primary",
    mobileLabel: "Properties",
    match: (p) => exactOrChild(p, "/client/listings"),
  },
  {
    id: "developments",
    label: "Developments",
    href: "/client/developments",
    icon: "developments",
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/developments"),
  },
  {
    id: "agents",
    label: "Team",
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
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/agents/performance"),
  },
  {
    id: "compliance-centre",
    label: "Compliance Centre",
    href: "/client/compliance/centre",
    icon: "compliance",
    section: "more_tools",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/compliance/centre"),
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
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/documents"),
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/client/calendar",
    icon: "calendar",
    section: "main",
    mobileSlot: "primary",
    mobileLabel: "Calendar",
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
    label: "Reports",
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
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/feedback"),
  },
  {
    id: "customers",
    label: "Customers",
    href: "/client/customers",
    icon: "customers",
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/customers"),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/client/settings",
    icon: "settings",
    section: "agency",
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
    section: "agency",
    mobileSlot: "more",
    match: (p) => exactOrChild(p, "/client/billing"),
  },
  {
    id: "review",
    label: "Review",
    href: "/client/review",
    icon: "reviews",
    section: "main",
    mobileSlot: "more",
    mobileLabel: "Review",
    match: (p) => p === "/client/review" || p.startsWith("/client/review/"),
  },
];

const SOLAR_COMPANY_NAV_IDS = new Set(["projects", "myWork"]);

/** Solar-only groups. General Trades keeps company / products / tools. */
export const SOLAR_COMPANY_SECTION_ORDER: CompanyNavSectionId[] = [
  "overview",
  "sales",
  "operations",
  "customers",
  "products",
  "intelligence",
  "management",
];

const SOLAR_COMPANY_SECTION_LABEL: Partial<Record<CompanyNavSectionId, string>> = {
  overview: "Overview",
  sales: "Sales",
  operations: "Field & delivery",
  customers: "Customers",
  products: "Products & stock",
  intelligence: "Intelligence",
  management: "Management",
};

const SOLAR_COMPANY_ITEM_ORDER = [
  "dashboard",
  "whatsapp",
  "pipeline",
  "socialInbox",
  "leads",
  "quotations",
  "myWork",
  "projects",
  "calendar",
  "customers",
  "products",
  "inventory",
  "packages",
  "command",
  "agent",
  "reports",
  "team",
  "documents",
  "billing",
  "settings",
] as const;

const SOLAR_COMPANY_PLACEMENT: Record<
  string,
  { section: CompanyNavSectionId; label?: string; mobileSlot: CompanyNavMobileSlot; mobileLabel?: string }
> = {
  dashboard: { section: "overview", mobileSlot: "primary", mobileLabel: "Dashboard" },
  whatsapp: { section: "sales", mobileSlot: "primary", mobileLabel: "WhatsApp" },
  pipeline: { section: "sales", label: "Solar Pipeline", mobileSlot: "primary", mobileLabel: "Pipeline" },
  socialInbox: { section: "sales", mobileSlot: "more", mobileLabel: "Social" },
  leads: { section: "sales", mobileSlot: "more", mobileLabel: "Leads" },
  quotations: { section: "sales", mobileSlot: "more", mobileLabel: "Quotes" },
  myWork: { section: "operations", mobileSlot: "more", mobileLabel: "My work" },
  projects: { section: "operations", mobileSlot: "primary", mobileLabel: "Projects" },
  calendar: { section: "operations", mobileSlot: "more", mobileLabel: "Calendar" },
  customers: { section: "customers", mobileSlot: "more", mobileLabel: "Customers" },
  products: { section: "products", mobileSlot: "more", mobileLabel: "Products" },
  inventory: { section: "products", mobileSlot: "more", mobileLabel: "Inventory" },
  packages: { section: "products", mobileSlot: "more", mobileLabel: "Packages" },
  command: { section: "intelligence", mobileSlot: "more", mobileLabel: "Command" },
  agent: { section: "intelligence", mobileSlot: "more", mobileLabel: "Agent" },
  reports: { section: "intelligence", mobileSlot: "more", mobileLabel: "Reports" },
  team: { section: "management", mobileSlot: "more", mobileLabel: "Team" },
  documents: { section: "management", mobileSlot: "more", mobileLabel: "Documents" },
  billing: { section: "management", mobileSlot: "more", mobileLabel: "Billing" },
  settings: { section: "management", mobileSlot: "more", mobileLabel: "Settings" },
};

function applySolarCompanyNavigation(items: CompanyNavItemConfig[]): CompanyNavItemConfig[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = SOLAR_COMPANY_ITEM_ORDER.flatMap((id) => {
    const item = byId.get(id);
    const place = SOLAR_COMPANY_PLACEMENT[id];
    if (!item || !place) return [];
    return [{ ...item, section: place.section, label: place.label ?? item.label, mobileSlot: place.mobileSlot, mobileLabel: place.mobileLabel ?? item.mobileLabel }];
  });
  const seen = new Set(ordered.map((item) => item.id));
  const extras = items
    .filter((item) => !seen.has(item.id))
    .map((item) => ({ ...item, section: "management" as const, mobileSlot: "more" as const }));
  return [...ordered, ...extras];
}

export function companySectionLabel(
  section: CompanyNavSectionId,
  options?: { solarWorkflow?: boolean }
): string {
  if (options?.solarWorkflow && SOLAR_COMPANY_SECTION_LABEL[section]) {
    return SOLAR_COMPANY_SECTION_LABEL[section]!;
  }
  return COMPANY_NAV_SECTION_LABEL[section];
}

export function getCompanyNavigation(
  businessType?: BusinessType | string | null,
  options?: { solarWorkflow?: boolean }
): CompanyNavItemConfig[] {
  if (isRealEstate(businessType)) return presentRealEstateCompanyNavigation(REAL_ESTATE_COMPANY_NAVIGATION);
  if (!options?.solarWorkflow) {
    return COMPANY_NAVIGATION.filter((item) => !SOLAR_COMPANY_NAV_IDS.has(item.id));
  }
  return applySolarCompanyNavigation(COMPANY_NAVIGATION);
}

export function getCompanyNavSectionOrder(
  businessType?: BusinessType | string | null,
  options?: { solarWorkflow?: boolean }
): CompanyNavSectionId[] {
  if (isRealEstate(businessType)) return COMPANY_NAV_SECTION_ORDER.real_estate;
  if (options?.solarWorkflow) return SOLAR_COMPANY_SECTION_ORDER;
  return COMPANY_NAV_SECTION_ORDER.trades;
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
