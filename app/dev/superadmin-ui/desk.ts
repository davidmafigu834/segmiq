import type { Mark } from "./primitives";
import type { Screen } from "./nav";

export type Org = {
  id: string;
  name: string;
  industry: string;
  plan: string;
  place: string;
  status: string;
  next: string;
  mark: Mark;
};

/** Studio desk. Counts on the overview are the length of this list, not a live metric. */
export const ORGS: Org[] = [
  {
    id: "charter",
    name: "Charter Properties",
    industry: "Real estate",
    plan: "Growth",
    place: "Harare",
    status: "Agreement unsigned",
    next: "The service agreement is still with the customer.",
    mark: "today",
  },
  {
    id: "highlands",
    name: "Highlands Realty",
    industry: "Real estate",
    plan: "Overdue",
    place: "Harare",
    status: "Invoice overdue",
    next: "INV-2041 is past the due date.",
    mark: "overdue",
  },
  {
    id: "lumina",
    name: "Lumina Solar",
    industry: "Solar",
    plan: "Growth",
    place: "Bulawayo",
    status: "Grace until 20 Nov",
    next: "Billing access ends Friday. The customer has been told.",
    mark: "waiting",
  },
  {
    id: "kwekwe",
    name: "Kwekwe Electrical",
    industry: "Trades",
    plan: "Legacy",
    place: "Kwekwe",
    status: "Legacy subscription",
    next: "Still on the old plan. Migration has not started.",
    mark: "waiting",
  },
];

export function orgById(id: string | null) {
  return ORGS.find((org) => org.id === id) ?? ORGS[0];
}

export type DeskRow = {
  name: string;
  meta: string;
  detail: string;
  action: string;
  screen: Screen;
  orgId?: string;
  mark?: Mark;
};

export const REGISTERS: Record<string, { kicker: string; title: string; detail: string; create?: string; rows: DeskRow[] }> = {
  users: {
    kicker: "Platform",
    title: "Users",
    detail: "People who can sign in. A locked account is the one that needs you.",
    rows: [
      { name: "Nyasha Dube", meta: "Charter Properties · Manager", detail: "Last sign-in was this morning.", action: "Open organisation", screen: "organisation", orgId: "charter" },
      { name: "Tariro Ncube", meta: "Highlands Realty · Manager", detail: "Sign-in is blocked until the overdue invoice is cleared.", action: "Open billing", screen: "billing", mark: "overdue" },
      { name: "Farai Moyo", meta: "Lumina Solar · Agent", detail: "Seat is inside the grace window.", action: "Open grace", screen: "grace", mark: "waiting" },
    ],
  },
  commercialHealth: {
    kicker: "Platform",
    title: "Commercial Health",
    detail: "Readiness stays fail-closed. One reconciliation is still open.",
    rows: [
      { name: "Usage reconciliation", meta: "Lumina Solar", detail: "Shadow usage does not match the allowance on the account.", action: "Open usage", screen: "ai", mark: "today" },
      { name: "Launch control", meta: "Customer-facing sales", detail: "No readiness state is inferred when the read model is missing.", action: "Open commercial", screen: "commercial" },
    ],
  },
  pricing: {
    kicker: "Commercial",
    title: "Pricing & Plans",
    detail: "Catalogue names only. Amounts stay on the live price catalogue.",
    rows: [
      { name: "Starter", meta: "CRM", detail: "Seat plan. Price is the catalogue row, not a figure on this desk.", action: "Open billing", screen: "billing" },
      { name: "Growth", meta: "CRM", detail: "Required before an Agentic AI allowance can be quoted.", action: "Open quotations", screen: "quotes", mark: "today" },
      { name: "Business", meta: "Agentic AI", detail: "Conversations and internal actions come from the catalogue row.", action: "Open usage", screen: "ai" },
      { name: "Scale", meta: "Agentic AI", detail: "Higher allowance. Still priced from the catalogue.", action: "Open usage", screen: "ai" },
    ],
  },
  billing: {
    kicker: "Commercial",
    title: "Customers & Billing",
    detail: "Subscriptions and the one invoice that is past due.",
    rows: [
      { name: "Highlands Realty", meta: "Overdue · INV-2041", detail: "The invoice is past the due date. Payment has not been recorded.", action: "Open invoice", screen: "invoice", orgId: "highlands", mark: "overdue" },
      { name: "Charter Properties", meta: "Growth · current", detail: "Subscription is current. The agreement is the open item.", action: "Open organisation", screen: "organisation", orgId: "charter", mark: "today" },
      { name: "Lumina Solar", meta: "Growth · grace", detail: "Access is temporary until Friday 20 Nov.", action: "Open grace", screen: "grace", mark: "waiting" },
      { name: "Kwekwe Electrical", meta: "Legacy", detail: "Old subscription. It is not a v2 commercial account yet.", action: "Open migration", screen: "migrations" },
    ],
  },
  migrations: {
    kicker: "Commercial",
    title: "Customer Migrations",
    detail: "Legacy subscriptions waiting for a controlled move. Nothing here provisions a customer.",
    rows: [
      { name: "Kwekwe Electrical", meta: "Legacy subscription", detail: "Migration has not started. The old plan is still the one on file.", action: "Open organisation", screen: "organisation", orgId: "kwekwe", mark: "today" },
    ],
  },
  prospects: {
    kicker: "Commercial",
    title: "Prospects",
    detail: "Platform-owned sales records. Creating one does not provision a customer.",
    create: "New prospect",
    rows: [
      { name: "Avondale Estates", meta: "Rumbidzai Sithole", detail: "Quoted Growth. Waiting on the customer to answer.", action: "Open quotation", screen: "quote", mark: "today" },
      { name: "Mutare Glass", meta: "Peter Chirwa", detail: "Prospect only. No quotation yet.", action: "Open quotations", screen: "quotes" },
    ],
  },
  quotes: {
    kicker: "Commercial",
    title: "Quotations",
    detail: "Issued offers. Q-184 is the one waiting on a response.",
    rows: [
      { name: "Q-184", meta: "Lumina Solar · sent", detail: "The customer has the link. No response yet.", action: "Open quotation", screen: "quote", mark: "today" },
      { name: "Q-179", meta: "Avondale Estates · changes requested", detail: "The customer asked for fewer seats.", action: "Open prospect", screen: "prospects" },
    ],
  },
  agreements: {
    kicker: "Commercial",
    title: "Agreements",
    detail: "Versioned service agreements. Charter Properties has not signed.",
    rows: [
      { name: "Charter Properties", meta: "Awaiting signature", detail: "The agreement was sent. The customer has not signed.", action: "Open organisation", screen: "organisation", orgId: "charter", mark: "today" },
      { name: "Lumina Solar", meta: "Signed", detail: "Current agreement is on file. Grace is a separate window.", action: "Open grace", screen: "grace" },
    ],
  },
  ai: {
    kicker: "Commercial",
    title: "Agentic AI Usage",
    detail: "Shadow metering against the allowance. One reconciliation is open.",
    rows: [
      { name: "Lumina Solar", meta: "Growth · Business allowance", detail: "Observed usage does not match the allowance. No charge is sent from this desk.", action: "Open health", screen: "commercialHealth", mark: "today" },
      { name: "Charter Properties", meta: "Growth · no AI sku", detail: "CRM only. Agentic AI is not on the account.", action: "Open organisation", screen: "organisation", orgId: "charter" },
    ],
  },
  topups: {
    kicker: "Commercial",
    title: "AI Top-ups",
    detail: "Conversation packs the customer has approved. None are waiting.",
    rows: [],
  },
  grace: {
    kicker: "Commercial",
    title: "Grace Periods",
    detail: "Temporary billing access. New windows are granted from the customer profile.",
    rows: [
      { name: "Lumina Solar", meta: "Active until 20 Nov", detail: "Reason: invoice is with the customer's accounts office. The customer has been told.", action: "Open organisation", screen: "organisation", orgId: "lumina", mark: "today" },
    ],
  },
  activity: {
    kicker: "Commercial",
    title: "Commercial Activity",
    detail: "What changed, and who did it. This register does not send a message.",
    rows: [
      { name: "Grace recorded", meta: "Lumina Solar · Rudo Chikwanha", detail: "Window set to end Friday 20 Nov. Notification recorded.", action: "Open grace", screen: "grace" },
      { name: "Agreement sent", meta: "Charter Properties · Rudo Chikwanha", detail: "Service agreement issued. Signature is still outstanding.", action: "Open agreements", screen: "agreements", mark: "today" },
      { name: "Invoice marked overdue", meta: "Highlands Realty", detail: "INV-2041 passed the due date. No payment is recorded.", action: "Open invoice", screen: "invoice", orgId: "highlands", mark: "overdue" },
    ],
  },
  incidents: {
    kicker: "Operations",
    title: "Platform Health",
    detail: "WhatsApp delivery is degraded. Status page is otherwise up.",
    create: "New incident",
    rows: [
      { name: "WhatsApp delivery", meta: "Degraded", detail: "Template sends are slow. No critical incident is open.", action: "Open WhatsApp", screen: "whatsapp", mark: "today" },
      { name: "Status page", meta: "Operational", detail: "The public status page is up.", action: "Open jobs", screen: "jobs" },
    ],
  },
  whatsapp: {
    kicker: "Operations",
    title: "WhatsApp",
    detail: "Templates used by organisations. Delivery is the item that needs you.",
    rows: [
      { name: "Viewing reminder", meta: "Approved · Charter Properties", detail: "Template is approved. Sends are slow while delivery is degraded.", action: "Open health", screen: "incidents", mark: "today" },
      { name: "Invoice nudge", meta: "Draft · Highlands Realty", detail: "Not submitted. It does not send.", action: "Open billing", screen: "billing" },
    ],
  },
  jobs: {
    kicker: "Operations",
    title: "Jobs",
    detail: "Follow-up jobs waiting to run. One is paused.",
    rows: [
      { name: "Follow-up reminders", meta: "Paused", detail: "Paused while WhatsApp delivery is degraded.", action: "Open health", screen: "incidents", mark: "today" },
      { name: "Invoice overdue sweep", meta: "Ran this morning", detail: "Marked Highlands Realty. No further sweep is queued.", action: "Open billing", screen: "billing" },
    ],
  },
  campaigns: {
    kicker: "Operations",
    title: "Campaigns",
    detail: "Outbound campaigns owned by organisations. None are waiting on the platform.",
    rows: [
      { name: "November listings", meta: "Charter Properties · scheduled", detail: "Goes out Tuesday. No platform hold.", action: "Open organisation", screen: "organisation", orgId: "charter" },
    ],
  },
  funnels: {
    kicker: "Operations",
    title: "Funnels",
    detail: "Bespoke property pages. Charter Properties has one live page.",
    rows: [
      { name: "Charter listings", meta: "Live", detail: "Public page is up. Enquiries land in the organisation, not here.", action: "Open organisation", screen: "organisation", orgId: "charter" },
    ],
  },
  reports: {
    kicker: "Operations",
    title: "Reports",
    detail: "Platform reports. The useful one today is the overdue invoice.",
    rows: [
      { name: "Overdue invoices", meta: "1 organisation", detail: "Highlands Realty is the only overdue account on this desk.", action: "Open billing", screen: "billing", mark: "overdue" },
      { name: "Open support sessions", meta: "1 session", detail: "Charter Properties, read-only, expires tonight.", action: "Open support", screen: "support", mark: "today" },
    ],
  },
  demos: {
    kicker: "Security",
    title: "Demonstrations",
    detail: "Guest links. They expire. They do not grant support access.",
    create: "New demonstration",
    rows: [
      { name: "Charter walkthrough", meta: "Expires Monday", detail: "Guest link for a sales demonstration. No customer data is included.", action: "Open organisation", screen: "organisation", orgId: "charter" },
    ],
  },
  proposals: {
    kicker: "Configuration",
    title: "Proposals",
    detail: "Sales proposal templates used before a quotation exists.",
    rows: [
      { name: "Growth proposal", meta: "Published", detail: "Used for Avondale Estates. Editing it does not change Q-184.", action: "Open quotations", screen: "quotes" },
    ],
  },
  blog: {
    kicker: "Configuration",
    title: "Blog",
    detail: "Public posts. Drafts stay off the site.",
    create: "New post",
    rows: [
      { name: "How a mandate is signed", meta: "Draft", detail: "Not published.", action: "Open settings", screen: "settings" },
    ],
  },
  submissions: {
    kicker: "Configuration",
    title: "Submissions",
    detail: "Marketing form submissions waiting for a person to read them.",
    rows: [
      { name: "Website enquiry", meta: "Unread", detail: "A visitor asked about Growth. It is not a prospect until you make one.", action: "Open prospects", screen: "prospects", mark: "today" },
    ],
  },
  upload: {
    kicker: "Configuration",
    title: "Upload",
    detail: "Files for the platform, not for a customer's listings.",
    rows: [
      { name: "Catalogue import", meta: "No file waiting", detail: "The live catalogue is the source of prices. This desk does not accept a replacement file.", action: "Open pricing", screen: "pricing" },
    ],
  },
};
