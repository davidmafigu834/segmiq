import type { AppShellNavGroup } from "@/components/shell/app-shell-types";

/** Super Admin navigation — existing routes only, grouped as a platform console. */
export const PLATFORM_NAV_GROUPS: AppShellNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Overview", icon: "layout-dashboard" }],
  },
  {
    label: "Customers",
    items: [
      { href: "/dashboard/clients", label: "Organisations", icon: "building2" },
      { href: "/dashboard/cloud-clients", label: "Users", icon: "users" },
      { href: "/dashboard/billing", label: "Subscriptions", icon: "receipt" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/status-incidents", label: "Platform Health", icon: "activity" },
      { href: "/dashboard/whatsapp-templates", label: "WhatsApp", icon: "message-circle" },
      { href: "/dashboard/follow-up-reminders", label: "Jobs", icon: "workflow" },
      { href: "/dashboard/campaigns", label: "Campaigns", icon: "megaphone" },
      { href: "/dashboard/reports", label: "Reports", icon: "bar-chart-3" },
    ],
  },
  {
    label: "Security",
    items: [{ href: "/dashboard/support-access", label: "Support Access", icon: "shield" }],
  },
  {
    label: "Configuration",
    items: [
      { href: "/dashboard/proposals", label: "Proposals", icon: "file-text" },
      { href: "/dashboard/blog", label: "Blog", icon: "file-text" },
      { href: "/dashboard/submissions", label: "Submissions", icon: "inbox" },
      { href: "/upload", label: "Upload", icon: "camera" },
      { href: "/dashboard/settings", label: "Platform Settings", icon: "settings" },
    ],
  },
];

export const PLATFORM_COMMAND_PAGES: { href: string; label: string; hint: string }[] = [
  { href: "/dashboard", label: "Overview", hint: "Platform operations" },
  { href: "/dashboard/clients", label: "Organisations", hint: "Customer tenants" },
  { href: "/dashboard/cloud-clients", label: "Users", hint: "Cloud subscriptions" },
  { href: "/dashboard/billing", label: "Subscriptions", hint: "Billing" },
  { href: "/dashboard/status-incidents", label: "Platform health", hint: "Incidents and status" },
  { href: "/dashboard/support-access", label: "Support access", hint: "Privileged sessions" },
  { href: "/dashboard/whatsapp-templates", label: "WhatsApp", hint: "Templates" },
  { href: "/dashboard/follow-up-reminders", label: "Jobs", hint: "Follow-up jobs" },
  { href: "/dashboard/settings", label: "Platform settings", hint: "Configuration" },
];
