/**
 * Valid prospect eligibility — anti-gaming for daily prospecting commitments.
 * Inbound Facebook/WhatsApp leads do NOT count as salesperson prospecting by default.
 */

import { INBOUND_LEAD_SOURCES, PROSPECTING_ELIGIBLE_SOURCES } from "./defaults";

export type ProspectCandidate = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  assignedToId: string | null;
  isArchived?: boolean | null;
  deletedAt?: string | null;
  createdAt: string;
  /** True when a duplicate phone/email already exists for this client (precomputed). */
  isDuplicate?: boolean;
  /** True when a qualifying outreach activity exists (call / WA / logged outreach). */
  hasOutreachActivity?: boolean;
  /** Soft flag for test / junk records if available. */
  isTest?: boolean;
};

export type ValidProspectResult = {
  valid: boolean;
  reason:
    | "ok"
    | "missing_identity"
    | "missing_contact"
    | "inbound_source"
    | "ineligible_source"
    | "wrong_owner"
    | "duplicate"
    | "archived"
    | "test"
    | "missing_outreach";
};

function hasIdentity(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  return n.length >= 2 && !/^test\b/i.test(n) && n.toLowerCase() !== "unknown";
}

function hasUsableContact(phone: string | null | undefined, email: string | null | undefined): boolean {
  const p = (phone ?? "").replace(/\D/g, "");
  const e = (email ?? "").trim();
  return p.length >= 7 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/**
 * Whether a lead may count toward the salesperson's daily prospecting commitment.
 * For MANUAL/outbound-style sources, require outreach activity when the flag is provided.
 */
export function isValidProspectingLead(
  lead: ProspectCandidate,
  opts: { salespersonId: string; requireOutreach?: boolean } 
): ValidProspectResult {
  if (lead.isArchived || lead.deletedAt) {
    return { valid: false, reason: "archived" };
  }
  if (lead.isTest) {
    return { valid: false, reason: "test" };
  }
  if (!hasIdentity(lead.name)) {
    return { valid: false, reason: "missing_identity" };
  }
  if (!hasUsableContact(lead.phone, lead.email)) {
    return { valid: false, reason: "missing_contact" };
  }
  if (lead.assignedToId !== opts.salespersonId) {
    return { valid: false, reason: "wrong_owner" };
  }
  if (lead.isDuplicate) {
    return { valid: false, reason: "duplicate" };
  }

  const source = (lead.source ?? "").toUpperCase();
  if (INBOUND_LEAD_SOURCES.has(source)) {
    return { valid: false, reason: "inbound_source" };
  }
  if (!PROSPECTING_ELIGIBLE_SOURCES.has(source)) {
    return { valid: false, reason: "ineligible_source" };
  }

  const requireOutreach = opts.requireOutreach !== false && source === "MANUAL";
  if (requireOutreach && lead.hasOutreachActivity === false) {
    return { valid: false, reason: "missing_outreach" };
  }

  return { valid: true, reason: "ok" };
}

export function countValidProspects(
  leads: ProspectCandidate[],
  salespersonId: string
): number {
  return leads.filter((l) => isValidProspectingLead(l, { salespersonId }).valid).length;
}
