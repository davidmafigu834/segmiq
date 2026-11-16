import type { SupabaseClient } from "@supabase/supabase-js";
import { phoneOrFilter, phonesMatch } from "@/lib/leads/phone-match";
import {
  fetchRoundRobinEligibleUsers,
  isRoundRobinEligibleUserId,
} from "@/lib/auth/sales-capabilities";

type Salesperson = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notification_prefs: unknown;
  round_robin_order: number;
};

/** Turn index is stored as a counter. The slot is that counter modulo the current rep list. */
export function roundRobinSlot(currentIndex: number, length: number): { slot: number; nextIndex: number } {
  if (length <= 0) return { slot: 0, nextIndex: 0 };
  const normalized = Number.isFinite(currentIndex) ? Math.trunc(currentIndex) : 0;
  const slot = ((normalized % length) + length) % length;
  return { slot, nextIndex: normalized + 1 };
}

/**
 * Advance the company counter only when this request still sees the same value.
 * Two chats arriving together then take two different reps.
 */
export async function claimRoundRobinAssignee<T extends { id: string }>(
  supabase: SupabaseClient,
  clientId: string,
  salespeople: T[]
): Promise<string | null> {
  if (!salespeople.length) return null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: client, error: readError } = await supabase
      .from("clients")
      .select("round_robin_index")
      .eq("id", clientId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    const current = Number(client?.round_robin_index ?? 0);
    const { slot, nextIndex } = roundRobinSlot(current, salespeople.length);
    const { data: updated, error } = await supabase
      .from("clients")
      .update({ round_robin_index: nextIndex, updated_at: new Date().toISOString() })
      .eq("id", clientId)
      .eq("round_robin_index", current)
      .select("id");
    if (error) throw new Error(error.message);
    if (updated && updated.length > 0) return salespeople[slot]?.id ?? null;
  }
  return salespeople[0]?.id ?? null;
}

export type PhoneClaim = "reserved" | "busy" | "unavailable";

/** One in-flight lead create per customer phone. Missing table keeps the older path working. */
export async function reserveInboundPhone(
  supabase: SupabaseClient,
  clientId: string,
  phoneDigits: string
): Promise<PhoneClaim> {
  const { error } = await supabase.from("whatsapp_phone_claims").insert({
    client_id: clientId,
    phone_digits: phoneDigits,
  });
  if (!error) return "reserved";
  if (error.code === "23505") return "busy";
  if (/does not exist|schema cache|whatsapp_phone_claims/i.test(error.message)) return "unavailable";
  throw new Error(error.message);
}

export async function releaseInboundPhone(
  supabase: SupabaseClient,
  clientId: string,
  phoneDigits: string
): Promise<void> {
  await supabase.from("whatsapp_phone_claims").delete().eq("client_id", clientId).eq("phone_digits", phoneDigits);
}

export async function inboundPhoneClaimAgeMs(
  supabase: SupabaseClient,
  clientId: string,
  phoneDigits: string
): Promise<number | null> {
  const { data } = await supabase
    .from("whatsapp_phone_claims")
    .select("created_at")
    .eq("client_id", clientId)
    .eq("phone_digits", phoneDigits)
    .maybeSingle();
  const created = Date.parse(String(data?.created_at ?? ""));
  if (!Number.isFinite(created)) return null;
  return Date.now() - created;
}

export async function findReturningAssignee(opts: {
  supabase: SupabaseClient;
  clientId: string;
  phoneDigits: string;
}): Promise<string | null> {
  const { supabase, clientId, phoneDigits } = opts;
  if (!phoneDigits) return null;

  const phoneFilter = phoneOrFilter(phoneDigits, ["phone"]);
  const contactFilter = phoneOrFilter(phoneDigits, ["phone", "whatsapp_wa_id"]);

  // Prefer assignee from contact-linked history (survives quiet periods / closed leads).
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, phone, whatsapp_wa_id")
    .eq("client_id", clientId)
    .or(contactFilter)
    .limit(25);

  const contactIds = (contacts ?? [])
    .filter(
      (c) =>
        phonesMatch(c.phone as string | null, phoneDigits) ||
        phonesMatch(c.whatsapp_wa_id as string | null, phoneDigits)
    )
    .map((c) => c.id as string);

  if (contactIds.length) {
    const { data: contactLeads } = await supabase
      .from("leads")
      .select("assigned_to_id, phone, updated_at")
      .eq("client_id", clientId)
      .in("contact_id", contactIds)
      .not("assigned_to_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(25);

    for (const row of contactLeads ?? []) {
      const assigneeId = (row.assigned_to_id as string | null) ?? null;
      if (!assigneeId) continue;
      const eligible = await isRoundRobinEligibleUserId(supabase, clientId, assigneeId);
      if (eligible) return assigneeId;
    }
  }

  // Phone-keyed lead history (not "last 50 any-phone leads").
  const { data: priorLeads } = await supabase
    .from("leads")
    .select("assigned_to_id, phone, status, updated_at")
    .eq("client_id", clientId)
    .not("assigned_to_id", "is", null)
    .or(phoneFilter)
    .order("updated_at", { ascending: false })
    .limit(50);

  const matched = (priorLeads ?? []).find((l) => phonesMatch(l.phone as string | null, phoneDigits));

  const assigneeId = (matched?.assigned_to_id as string | null) ?? null;
  if (!assigneeId) return null;

  const eligible = await isRoundRobinEligibleUserId(supabase, clientId, assigneeId);
  return eligible ? assigneeId : null;
}

export async function pickAssigneeForInbound(opts: {
  supabase: SupabaseClient;
  clientId: string;
  assignmentMode: string;
  phoneDigits?: string | null;
}): Promise<{ assigneeId: string | null; salespeople: Salesperson[] }> {
  const { supabase, clientId, assignmentMode, phoneDigits } = opts;
  const mode = assignmentMode === "pool" || assignmentMode === "round_robin" ? assignmentMode : "direct";

  const { data: salespeople } = await fetchRoundRobinEligibleUsers(supabase, clientId);

  const list = (salespeople ?? []) as unknown as Salesperson[];
  if (list.length === 0) {
    return { assigneeId: null, salespeople: list };
  }

  if (phoneDigits) {
    const returningId = await findReturningAssignee({ supabase, clientId, phoneDigits });
    if (returningId && list.some((s) => s.id === returningId)) {
      return { assigneeId: returningId, salespeople: list };
    }
  }

  if (mode !== "round_robin") {
    return { assigneeId: null, salespeople: list };
  }

  const assigneeId = await claimRoundRobinAssignee(supabase, clientId, list);
  return { assigneeId, salespeople: list };
}
