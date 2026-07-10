import { apiGet, apiPost } from "./api";
import type { LeadStatus } from "./types";

export type ContactLookupMatch = {
  id: string;
  name: string | null;
  lifecycle: string;
  owner?: string | null;
  lastTouchedAt?: string | null;
};

const SOURCES = ["Referral", "Walk-in", "Phone call", "WhatsApp", "Repeat customer", "Other"];

export { SOURCES };

export async function lookupContactByPhone(phone: string): Promise<ContactLookupMatch | null> {
  const raw = phone.trim();
  if (raw.replace(/\D/g, "").length < 6) return null;
  const res = await apiGet<{ match?: ContactLookupMatch | null }>(
    `/api/contacts/lookup?${new URLSearchParams({ phone: raw })}`
  );
  if (!res.ok) return null;
  return res.data.match ?? null;
}

export type CreateLeadInput = {
  name?: string;
  phone: string;
  source: string;
  priority?: "hot" | "warm" | "cold";
  initialStatus?: LeadStatus;
  dealValue?: number;
  email?: string;
  projectType?: string;
  budget?: string;
  notes?: string;
  forceNew?: boolean;
};

export async function createManualLead(input: CreateLeadInput): Promise<{ leadId: string }> {
  const res = await apiPost<
    | { ok?: boolean; leadId?: string; error?: string; existing?: ContactLookupMatch }
    | { error: string; existing?: ContactLookupMatch }
  >("/api/contacts", {
    type: "lead",
    phone: input.phone.trim(),
    source: input.source,
    name: input.name?.trim() || undefined,
    email: input.email?.trim() || undefined,
    projectType: input.projectType?.trim() || undefined,
    budget: input.budget?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    priority: input.priority ?? "warm",
    initialStatus: input.initialStatus,
    dealValue: input.dealValue,
    forceNew: input.forceNew || undefined,
  });

  if (res.status === 409 && res.data.error === "duplicate") {
    const err = new Error("duplicate") as Error & { existing?: ContactLookupMatch };
    err.existing = (res.data as { existing?: ContactLookupMatch }).existing;
    throw err;
  }

  if (!res.ok || !("leadId" in res.data) || !res.data.leadId) {
    throw new Error((res.data as { error?: string }).error ?? "Could not add lead");
  }

  return { leadId: res.data.leadId as string };
}
