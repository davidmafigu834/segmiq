export type WorkspaceShortcut = { href: string; label: string };

function within(pathname: string, roots: readonly string[]): boolean {
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

const CONVERSATION_CANVASES = [
  "/sales/inbox",
  "/sales/social-inbox",
  "/sales/command",
  "/client/inbox",
  "/client/social-inbox",
  "/client/command",
] as const;

const AGENT_PROPERTIES = [
  "/sales/listings",
  "/sales/acquisitions",
  "/sales/mandates",
  "/sales/inspections",
  "/sales/offers",
  "/sales/shared-listings",
  "/sales/matching",
] as const;

const MANAGER_PROPERTIES = [
  "/client/listings",
  "/client/acquisitions",
  "/client/inspections",
  "/client/offers",
  "/client/matching",
] as const;

const MANAGER_REVIEW = [
  "/client/review",
  "/client/mandates",
  "/client/compliance",
  "/client/commissions",
] as const;

function exceptCurrent(pathname: string, links: readonly WorkspaceShortcut[]): WorkspaceShortcut[] {
  return links.filter((link) => link.href !== pathname);
}

/** Compact links for the agent workspace. Empty on hub pages and conversation canvases. */
export function agentWorkspaceShortcuts(pathname: string): WorkspaceShortcut[] {
  if (within(pathname, CONVERSATION_CANVASES)) return [];
  if (pathname === "/sales/people" || pathname.startsWith("/sales/people/")) return [];
  if (pathname === "/sales/dashboard") {
    return [
      { href: "/sales/inbox", label: "Sales Inbox" },
      { href: "/sales/tasks", label: "My Activities" },
      { href: "/sales/leads", label: "Inquiries" },
      { href: "/sales/social-inbox", label: "Social" },
    ];
  }
  if (within(pathname, AGENT_PROPERTIES)) {
    return exceptCurrent(pathname, [
      { href: "/sales/listings", label: "Properties" },
      { href: "/sales/acquisitions", label: "Drafts" },
      { href: "/sales/mandates", label: "Mandates" },
      { href: "/sales/inspections", label: "Inspections" },
      { href: "/sales/offers", label: "Offers" },
      { href: "/sales/shared-listings", label: "Sharing" },
      { href: "/sales/matching", label: "Matching" },
    ]);
  }
  if (within(pathname, ["/sales/calendar", "/sales/viewings"])) {
    return exceptCurrent(pathname, [
      { href: "/sales/calendar", label: "Calendar" },
      { href: "/sales/viewings", label: "Viewings" },
    ]);
  }
  if (within(pathname, ["/sales/owners", "/sales/buyers"])) {
    return exceptCurrent(pathname, [
      { href: "/sales/people", label: "People" },
      { href: "/sales/owners", label: "Sellers" },
      { href: "/sales/buyers", label: "Buyers & Tenants" },
      { href: "/sales/buyers/introductions", label: "Introductions" },
    ]);
  }
  if (within(pathname, ["/sales/transactions", "/sales/compliance"])) {
    return exceptCurrent(pathname, [
      { href: "/sales/transactions", label: "Transactions" },
      { href: "/sales/compliance", label: "Compliance" },
    ]);
  }
  return [];
}

/** Compact links for the manager workspace. Empty on hub pages and conversation canvases. */
export function managerWorkspaceShortcuts(pathname: string): WorkspaceShortcut[] {
  if (within(pathname, CONVERSATION_CANVASES)) return [];
  if (pathname === "/client/people" || pathname.startsWith("/client/people/")) return [];
  if (pathname === "/client/review" || pathname.startsWith("/client/review/")) return [];
  if (pathname === "/client/dashboard") {
    return [
      { href: "/client/inbox", label: "Sales Inbox" },
      { href: "/client/leads", label: "Inquiries" },
      { href: "/client/social-inbox", label: "Social" },
      { href: "/client/review", label: "Review" },
    ];
  }
  if (within(pathname, MANAGER_PROPERTIES)) {
    return exceptCurrent(pathname, [
      { href: "/client/listings", label: "Properties" },
      { href: "/client/acquisitions", label: "Drafts" },
      { href: "/client/inspections", label: "Inspections" },
      { href: "/client/offers", label: "Offers" },
      { href: "/client/matching", label: "Matching" },
    ]);
  }
  if (within(pathname, ["/client/calendar", "/client/viewings"])) {
    return exceptCurrent(pathname, [
      { href: "/client/calendar", label: "Calendar" },
      { href: "/client/viewings", label: "Viewings" },
    ]);
  }
  if (within(pathname, ["/client/owners", "/client/buyers", "/client/contacts", "/client/customers"])) {
    return exceptCurrent(pathname, [
      { href: "/client/people", label: "People" },
      { href: "/client/owners", label: "Sellers" },
      { href: "/client/buyers", label: "Buyers & Tenants" },
      { href: "/client/buyers/introductions", label: "Introductions" },
      { href: "/client/contacts", label: "Contacts" },
      { href: "/client/customers", label: "Customers" },
    ]);
  }
  if (within(pathname, MANAGER_REVIEW)) {
    return exceptCurrent(pathname, [
      { href: "/client/review", label: "Review" },
      { href: "/client/mandates", label: "Mandates" },
      { href: "/client/compliance/reviews", label: "Reviews" },
      { href: "/client/compliance", label: "Compliance Cases" },
      { href: "/client/compliance/centre", label: "Compliance Centre" },
      { href: "/client/commissions", label: "Payments" },
    ]);
  }
  return [];
}

export const AGENT_PEOPLE_LINKS: WorkspaceShortcut[] = [
  { href: "/sales/owners", label: "Sellers" },
  { href: "/sales/buyers", label: "Buyers & Tenants" },
  { href: "/sales/buyers/introductions", label: "Introductions" },
];

export const MANAGER_PEOPLE_LINKS: WorkspaceShortcut[] = [
  { href: "/client/owners", label: "Sellers" },
  { href: "/client/buyers", label: "Buyers & Tenants" },
  { href: "/client/buyers/introductions", label: "Introductions" },
  { href: "/client/contacts", label: "Contacts" },
  { href: "/client/customers", label: "Customers" },
];

export const MANAGER_REVIEW_LINKS: Array<WorkspaceShortcut & { countPrefix?: string }> = [
  { href: "/client/mandates", label: "Mandate approvals", countPrefix: "mandate" },
  { href: "/client/listings", label: "Listing approvals", countPrefix: "listing" },
  { href: "/client/compliance/reviews", label: "Reviews" },
  { href: "/client/compliance", label: "Compliance Cases" },
  { href: "/client/compliance/centre", label: "Compliance Centre" },
  { href: "/client/commissions", label: "Payments to verify", countPrefix: "pay" },
];
