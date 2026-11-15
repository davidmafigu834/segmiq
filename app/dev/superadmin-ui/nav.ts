import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building2,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react";

export type Screen =
  | "overview"
  | "organisations"
  | "organisation"
  | "users"
  | "commercialHealth"
  | "commercial"
  | "pricing"
  | "billing"
  | "invoice"
  | "migrations"
  | "prospects"
  | "quotes"
  | "quote"
  | "agreements"
  | "ai"
  | "topups"
  | "grace"
  | "activity"
  | "incidents"
  | "whatsapp"
  | "jobs"
  | "campaigns"
  | "funnels"
  | "reports"
  | "support"
  | "demos"
  | "proposals"
  | "blog"
  | "submissions"
  | "upload"
  | "settings"
  | "states"
  | "signin";

export const SCREENS: Screen[] = [
  "overview",
  "organisations",
  "organisation",
  "users",
  "commercialHealth",
  "commercial",
  "pricing",
  "billing",
  "invoice",
  "migrations",
  "prospects",
  "quotes",
  "quote",
  "agreements",
  "ai",
  "topups",
  "grace",
  "activity",
  "incidents",
  "whatsapp",
  "jobs",
  "campaigns",
  "funnels",
  "reports",
  "support",
  "demos",
  "proposals",
  "blog",
  "submissions",
  "upload",
  "settings",
  "states",
  "signin",
];

export function asScreen(value: string | undefined): Screen {
  return SCREENS.includes(value as Screen) ? (value as Screen) : "overview";
}

export type Child = { id: string; label: string; screen: Screen };
export type Item = { id: string; label: string; icon: LucideIcon; screen?: Screen; children?: Child[] };

/** Same groups as the live superadmin sidebar in components/platform/nav.ts. */
export const NAV: Item[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, screen: "overview" },
  {
    id: "platform",
    label: "Platform",
    icon: Building2,
    children: [
      { id: "organisations", label: "Organisations", screen: "organisations" },
      { id: "users", label: "Users", screen: "users" },
      { id: "commercialHealth", label: "Commercial Health", screen: "commercialHealth" },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    icon: Receipt,
    children: [
      { id: "commercial", label: "Overview", screen: "commercial" },
      { id: "pricing", label: "Pricing & Plans", screen: "pricing" },
      { id: "billing", label: "Customers & Billing", screen: "billing" },
      { id: "migrations", label: "Customer Migrations", screen: "migrations" },
      { id: "prospects", label: "Prospects", screen: "prospects" },
      { id: "quotes", label: "Quotations", screen: "quotes" },
      { id: "agreements", label: "Agreements", screen: "agreements" },
      { id: "ai", label: "Agentic AI Usage", screen: "ai" },
      { id: "topups", label: "AI Top-ups", screen: "topups" },
      { id: "grace", label: "Grace Periods", screen: "grace" },
      { id: "activity", label: "Commercial Activity", screen: "activity" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Activity,
    children: [
      { id: "incidents", label: "Platform Health", screen: "incidents" },
      { id: "whatsapp", label: "WhatsApp", screen: "whatsapp" },
      { id: "jobs", label: "Jobs", screen: "jobs" },
      { id: "campaigns", label: "Campaigns", screen: "campaigns" },
      { id: "funnels", label: "Funnels", screen: "funnels" },
      { id: "reports", label: "Reports", screen: "reports" },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    children: [
      { id: "support", label: "Support Access", screen: "support" },
      { id: "demos", label: "Demonstrations", screen: "demos" },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    icon: Settings,
    children: [
      { id: "proposals", label: "Proposals", screen: "proposals" },
      { id: "blog", label: "Blog", screen: "blog" },
      { id: "submissions", label: "Submissions", screen: "submissions" },
      { id: "upload", label: "Upload", screen: "upload" },
      { id: "settings", label: "Platform Settings", screen: "settings" },
    ],
  },
  { id: "states", label: "Screen states", icon: Sparkles, screen: "states" },
];

export const DOCK: Array<Item & { screen: Screen }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, screen: "overview" },
  { id: "organisations", label: "Organisations", icon: Building2, screen: "organisations" },
  { id: "commercial", label: "Commercial", icon: Receipt, screen: "commercial" },
  { id: "billing", label: "Billing", icon: FileText, screen: "billing" },
];

export const STARTS: Array<{ label: string; screen: Screen; id?: string }> = [
  { label: "Organisation", screen: "organisations", id: "add" },
  { label: "Prospect", screen: "prospects", id: "add" },
  { label: "Incident", screen: "incidents", id: "add" },
];

export function screenOn(item: Screen, current: Screen) {
  if (item === current) return true;
  if (item === "organisations" && current === "organisation") return true;
  if (item === "quotes" && current === "quote") return true;
  if (item === "billing" && current === "invoice") return true;
  return false;
}

export function groupFor(screen: Screen) {
  return NAV.find((item) => item.children?.some((child) => screenOn(child.screen, screen)))?.id ?? null;
}
