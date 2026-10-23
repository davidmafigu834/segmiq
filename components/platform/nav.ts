import type { AppShellNavGroup } from "@/components/shell/app-shell-types";

/** Super Admin navigation — platform operations and the commercial lifecycle stay distinct. */
export const PLATFORM_NAV_GROUPS: AppShellNavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard", label: "Overview", icon: "layout-dashboard" },
      { href: "/dashboard/clients", label: "Organisations", icon: "building2" },
      { href: "/dashboard/cloud-clients", label: "Users", icon: "users" },
      { href: "/dashboard/commercial-health", label: "Commercial Health", icon: "shield" },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/dashboard/commercial", label: "Overview", icon: "layout-dashboard" },
      { href: "/dashboard/pricing", label: "Pricing & Plans", icon: "receipt" },
      { href: "/dashboard/billing", label: "Customers & Billing", icon: "building2" },
      {
        href: "/dashboard/commercial-migrations",
        label: "Customer Migrations",
        icon: "workflow",
      },
      {
        href: "/dashboard/commercial-sales",
        label: "Prospects",
        icon: "file-text",
      },
      { href: "/dashboard/commercial-sales?view=quotes", label: "Quotations", icon: "file-text" },
      {
        href: "/dashboard/commercial-sales/agreements",
        label: "Agreements",
        icon: "scroll-text",
      },
      {
        href: "/dashboard/commercial-ai-usage",
        label: "Agentic AI Usage",
        icon: "activity",
      },
      {
        href: "/dashboard/commercial-topups",
        label: "AI Top-ups",
        icon: "receipt",
      },
      { href: "/dashboard/grace-periods", label: "Grace Periods", icon: "clock" },
      { href: "/dashboard/commercial-activity", label: "Commercial Activity", icon: "activity" },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/dashboard/status-incidents",
        label: "Platform Health",
        icon: "activity",
      },
      {
        href: "/dashboard/whatsapp-templates",
        label: "WhatsApp",
        icon: "message-circle",
      },
      {
        href: "/dashboard/follow-up-reminders",
        label: "Jobs",
        icon: "workflow",
      },
      { href: "/dashboard/campaigns", label: "Campaigns", icon: "megaphone" },
      { href: "/dashboard/reports", label: "Reports", icon: "bar-chart-3" },
    ],
  },
  {
    label: "Security",
    items: [
      {
        href: "/dashboard/support-access",
        label: "Support Access",
        icon: "shield",
      },
      { href: "/dashboard/demos", label: "Demonstrations", icon: "sparkles" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/dashboard/proposals", label: "Proposals", icon: "file-text" },
      { href: "/dashboard/blog", label: "Blog", icon: "file-text" },
      { href: "/dashboard/submissions", label: "Submissions", icon: "inbox" },
      { href: "/upload", label: "Upload", icon: "camera" },
      {
        href: "/dashboard/settings",
        label: "Platform Settings",
        icon: "settings",
      },
    ],
  },
];

export const PLATFORM_COMMAND_PAGES: {
  href: string;
  label: string;
  hint: string;
}[] = [
  { href: "/dashboard", label: "Overview", hint: "Platform operations" },
  { href: "/dashboard/commercial", label: "Commercial Overview", hint: "Revenue operations" },
  {
    href: "/dashboard/clients",
    label: "Organisations",
    hint: "Customer tenants",
  },
  {
    href: "/dashboard/cloud-clients",
    label: "Users",
    hint: "Cloud subscriptions",
  },
  { href: "/dashboard/billing", label: "Subscriptions", hint: "Billing" },
  {
    href: "/dashboard/pricing",
    label: "Pricing & Plans",
    hint: "Commercial catalogue",
  },
  {
    href: "/dashboard/commercial-migrations",
    label: "Customer Migrations",
    hint: "Controlled legacy transitions",
  },
  {
    href: "/dashboard/commercial-sales",
    label: "Prospects",
    hint: "Platform-owned sales records",
  },
  { href: "/dashboard/commercial-sales?view=quotes", label: "Quotations", hint: "Commercial offers and revisions" },
  {
    href: "/dashboard/commercial-sales/agreements",
    label: "Agreements",
    hint: "Versioned service agreements",
  },
  {
    href: "/dashboard/commercial-ai-usage",
    label: "AI Usage",
    hint: "Shadow metering and allowances",
  },
  {
    href: "/dashboard/commercial-topups",
    label: "AI Top-ups",
    hint: "Customer-approved conversation packs",
  },
  {
    href: "/dashboard/commercial-health",
    label: "Commercial Health",
    hint: "Readiness, reconciliation and launch control",
  },
  { href: "/dashboard/grace-periods", label: "Grace Periods", hint: "Temporary billing-access exceptions" },
  { href: "/dashboard/commercial-activity", label: "Commercial Activity", hint: "Immutable audit history" },
  {
    href: "/dashboard/status-incidents",
    label: "Platform health",
    hint: "Incidents and status",
  },
  {
    href: "/dashboard/support-access",
    label: "Support access",
    hint: "Privileged sessions",
  },
  {
    href: "/dashboard/demos",
    label: "Demonstrations",
    hint: "Guest demonstration links",
  },
  {
    href: "/dashboard/whatsapp-templates",
    label: "WhatsApp",
    hint: "Templates",
  },
  {
    href: "/dashboard/follow-up-reminders",
    label: "Jobs",
    hint: "Follow-up jobs",
  },
  {
    href: "/dashboard/settings",
    label: "Platform settings",
    hint: "Configuration",
  },
];
