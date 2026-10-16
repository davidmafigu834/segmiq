import { createAdminClient } from "@/lib/supabase/admin";

/** Subjects the shared activity row can point at. Solar lead follow-ups are unchanged. */
export const ACTIVITY_SUBJECT_TYPES = [
  "lead",
  "buyer_search",
  "listing",
  "viewing",
  "offer",
  "transaction",
  "contact",
  "acquisition",
  "inspection",
  "mandate",
] as const;

export type ActivitySubjectType = (typeof ACTIVITY_SUBJECT_TYPES)[number];

const TABLE_BY_SUBJECT: Record<ActivitySubjectType, string> = {
  lead: "leads",
  buyer_search: "real_estate_buyer_searches",
  listing: "listings",
  viewing: "viewings",
  offer: "real_estate_offers",
  transaction: "real_estate_transactions",
  contact: "contacts",
  acquisition: "real_estate_acquisition_opportunities",
  inspection: "real_estate_inspections",
  mandate: "real_estate_mandates",
};

export function isActivitySubjectType(value: string): value is ActivitySubjectType {
  return (ACTIVITY_SUBJECT_TYPES as readonly string[]).includes(value);
}

export async function assertActivitySubject(input: {
  clientId: string;
  subjectType: ActivitySubjectType;
  subjectId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const table = TABLE_BY_SUBJECT[input.subjectType];
  const columns = input.subjectType === "viewing" ? "id, client_id, listing_id" : "id, client_id";
  const { data: found, error } = await supabase
    .from(table)
    .select(columns)
    .eq("id", input.subjectId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const data = found as { client_id?: string | null; listing_id?: string } | null;
  if (!data) return { ok: false, error: "Related record was not found." };
  const owner = data.client_id ?? null;
  if (owner && owner !== input.clientId) {
    return { ok: false, error: "Related record belongs to another organisation." };
  }
  if (!owner && input.subjectType === "viewing") {
    const { data: listing } = await supabase
      .from("listings")
      .select("client_id")
      .eq("id", (data as { listing_id?: string }).listing_id ?? "")
      .maybeSingle();
    if (!listing || listing.client_id !== input.clientId) {
      return { ok: false, error: "Viewing is outside this organisation." };
    }
  }
  return { ok: true };
}

export async function createSubjectActivity(input: {
  clientId: string;
  subjectType: ActivitySubjectType;
  subjectId: string;
  title: string;
  assignedToId?: string | null;
  dueAt?: string | null;
  priority?: "high" | "medium" | "low";
  notes?: string | null;
  createdBy?: string | null;
  leadId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const subject = await assertActivitySubject(input);
  if (!subject.ok) return subject;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("activity_subjects")
    .insert({
      client_id: input.clientId,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      lead_id: input.leadId ?? null,
      assigned_to_id: input.assignedToId ?? null,
      title: input.title,
      due_at: input.dueAt ?? null,
      priority: input.priority ?? "medium",
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create activity." };
  return { ok: true, id: data.id as string };
}

export async function completeSubjectActivity(input: {
  clientId: string;
  activityId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("activity_subjects")
    .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", input.activityId)
    .eq("client_id", input.clientId)
    .is("completed_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Activity not found." };
  return { ok: true };
}

export async function reassignSubjectActivity(input: {
  clientId: string;
  activityId: string;
  assignedToId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, client_id")
    .eq("id", input.assignedToId)
    .maybeSingle();
  if (!user || user.client_id !== input.clientId) {
    return { ok: false, error: "Assignee is not in this organisation." };
  }
  const { data, error } = await supabase
    .from("activity_subjects")
    .update({ assigned_to_id: input.assignedToId, updated_at: new Date().toISOString() })
    .eq("id", input.activityId)
    .eq("client_id", input.clientId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Activity not found." };
  return { ok: true };
}
