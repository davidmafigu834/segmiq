/**
 * Client-data categories a Support Access grant can cover.
 *
 * SECURITY: unknown scope strings are dropped (default deny). A grant with no
 * recognised scope authorises nothing.
 */

export const SUPPORT_ACCESS_SCOPES = {
  CUSTOMER_PROFILES: "CUSTOMER_PROFILES",
  LEADS: "LEADS",
  DEALS: "DEALS",
  CONVERSATIONS: "CONVERSATIONS",
  QUOTATIONS: "QUOTATIONS",
  DOCUMENTS: "DOCUMENTS",
  FILES: "FILES",
  AGENT_ACTIVITY: "AGENT_ACTIVITY",
} as const;

export type SupportAccessScope =
  (typeof SUPPORT_ACCESS_SCOPES)[keyof typeof SUPPORT_ACCESS_SCOPES];

export const ALL_SUPPORT_ACCESS_SCOPES = Object.values(
  SUPPORT_ACCESS_SCOPES
) as SupportAccessScope[];

export const SUPPORT_ACCESS_SCOPE_LABELS: Record<SupportAccessScope, string> = {
  CUSTOMER_PROFILES: "Customer profiles",
  LEADS: "Leads",
  DEALS: "Deals",
  CONVERSATIONS: "Conversations",
  QUOTATIONS: "Quotations",
  DOCUMENTS: "Documents",
  FILES: "Files",
  AGENT_ACTIVITY: "Agent activity",
};

export const SUPPORT_ACCESS_SCOPE_DESCRIPTIONS: Record<SupportAccessScope, string> = {
  CUSTOMER_PROFILES: "Contact records and customer detail pages",
  LEADS: "Lead records, pipeline entries and lead activity",
  DEALS: "Deal records, values and deal notes",
  CONVERSATIONS: "WhatsApp, Messenger, Instagram and comment threads",
  QUOTATIONS: "Quotation and invoice contents",
  DOCUMENTS: "Uploaded documents and contracts",
  FILES: "Media, attachments and download links",
  AGENT_ACTIVITY: "Agent runs, prompts, summaries and Company Brain",
};

export function isSupportAccessScope(value: unknown): value is SupportAccessScope {
  return (
    typeof value === "string" &&
    (ALL_SUPPORT_ACCESS_SCOPES as string[]).includes(value)
  );
}

/** Normalise a scope list from an untrusted source; unknown entries are dropped. */
export function parseSupportAccessScopes(input: unknown): SupportAccessScope[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<SupportAccessScope>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const candidate = raw.trim().toUpperCase();
    if (isSupportAccessScope(candidate)) out.add(candidate);
  }
  return ALL_SUPPORT_ACCESS_SCOPES.filter((s) => out.has(s));
}

export function supportAccessScopeLabels(scopes: readonly SupportAccessScope[]): string {
  if (!scopes.length) return "No scopes";
  return scopes.map((s) => SUPPORT_ACCESS_SCOPE_LABELS[s]).join(" · ");
}
