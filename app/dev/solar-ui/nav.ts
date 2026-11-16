import type { LucideIcon } from "lucide-react";
import {
  FolderKanban,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Package,
  Settings,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

/** Screens in the solar installation company mock. Detail screens are reached from a list. */
export type Screen =
  | "dashboard"
  | "whatsapp"
  | "pipeline"
  | "opportunity"
  | "social"
  | "leads"
  | "quotations"
  | "quote"
  | "work"
  | "visit"
  | "projects"
  | "project"
  | "calendar"
  | "customers"
  | "customer"
  | "products"
  | "inventory"
  | "packages"
  | "command"
  | "agent"
  | "reports"
  | "team"
  | "documents"
  | "billing"
  | "settings"
  | "states"
  | "signin";

export const SCREENS: Screen[] = [
  "dashboard",
  "whatsapp",
  "pipeline",
  "opportunity",
  "social",
  "leads",
  "quotations",
  "quote",
  "work",
  "visit",
  "projects",
  "project",
  "calendar",
  "customers",
  "customer",
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
  "states",
  "signin",
];

export function asScreen(value: string | undefined): Screen {
  return SCREENS.includes(value as Screen) ? (value as Screen) : "dashboard";
}

export type Child = { id: string; label: string; screen: Screen };
export type Item = { id: string; label: string; icon: LucideIcon; screen?: Screen; children?: Child[] };

/**
 * Same groups as a solar company in lib/sales/navigation/company-nav-config.ts
 * (Overview, Sales, Field & delivery, Customers, Products & stock, Intelligence, Management).
 */
export const NAV: Item[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, screen: "dashboard" },
  {
    id: "sales",
    label: "Sales",
    icon: Workflow,
    children: [
      { id: "whatsapp", label: "WhatsApp Sales Hub", screen: "whatsapp" },
      { id: "pipeline", label: "Solar Pipeline", screen: "pipeline" },
      { id: "social", label: "Social Inbox", screen: "social" },
      { id: "leads", label: "Leads", screen: "leads" },
      { id: "quotations", label: "Quotations", screen: "quotations" },
    ],
  },
  {
    id: "operations",
    label: "Field & delivery",
    icon: FolderKanban,
    children: [
      { id: "work", label: "My work", screen: "work" },
      { id: "projects", label: "Projects", screen: "projects" },
      { id: "calendar", label: "Calendar", screen: "calendar" },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    children: [{ id: "customers", label: "Customers", screen: "customers" }],
  },
  {
    id: "products",
    label: "Products & stock",
    icon: Package,
    children: [
      { id: "products", label: "Products", screen: "products" },
      { id: "inventory", label: "Inventory", screen: "inventory" },
      { id: "packages", label: "Packages", screen: "packages" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    icon: Sparkles,
    children: [
      { id: "command", label: "Command Center", screen: "command" },
      { id: "agent", label: "SegmiQ Agent", screen: "agent" },
      { id: "reports", label: "Reports", screen: "reports" },
    ],
  },
  {
    id: "management",
    label: "Management",
    icon: Settings,
    children: [
      { id: "team", label: "Team", screen: "team" },
      { id: "documents", label: "Documents", screen: "documents" },
      { id: "billing", label: "Billing", screen: "billing" },
      { id: "settings", label: "Settings", screen: "settings" },
    ],
  },
  { id: "states", label: "Screen states", icon: Inbox, screen: "states" },
];

/** Bottom bar matches the solar primary slots: Dashboard, WhatsApp, Pipeline, Projects. */
export const DOCK: Array<Item & { screen: Screen }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, screen: "dashboard" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, screen: "whatsapp" },
  { id: "pipeline", label: "Pipeline", icon: Workflow, screen: "pipeline" },
  { id: "projects", label: "Projects", icon: FolderKanban, screen: "projects" },
];

export const STARTS: Array<{ label: string; screen: Screen; id?: string }> = [
  { label: "Lead", screen: "leads", id: "add" },
  { label: "Site visit", screen: "work", id: "visit" },
  { label: "Project", screen: "projects", id: "add" },
  { label: "Quotation", screen: "quotations", id: "add" },
];

export function screenOn(item: Screen, current: Screen) {
  if (item === current) return true;
  if (item === "pipeline" && current === "opportunity") return true;
  if (item === "whatsapp" && current === "opportunity") return true;
  if (item === "quotations" && current === "quote") return true;
  if (item === "work" && current === "visit") return true;
  if (item === "projects" && current === "project") return true;
  if (item === "customers" && current === "customer") return true;
  return false;
}

export function groupFor(screen: Screen) {
  return NAV.find((item) => item.children?.some((child) => screenOn(child.screen, screen)))?.id ?? null;
}
