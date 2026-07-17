import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONTACT_LIFECYCLES,
  type ContactLifecycle,
  isContactLifecycle,
} from "@/lib/customer-hub/lifecycle";

function normalizeSource(raw: string | null): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "walk-in" || s === "walk_in") return "walk_in";
  if (s === "whatsapp" || s === "whatsapp_inbound") return "whatsapp_inbound";
  if (s === "whatsapp_saved") return "whatsapp_saved";
  if (s === "facebook" || s === "landing_page") return "facebook";
  if (s === "referral" || s === "manual") return "referral";
  return "other";
}

async function callLogCountByContact(
  supabase: SupabaseClient,
  clientId: string
): Promise<Map<string, number>> {
  const { data: leads } = await supabase
    .from("leads")
    .select("id, contact_id")
    .eq("client_id", clientId)
    .not("contact_id", "is", null);

  const leadIds = (leads ?? []).map((l) => l.id as string);
  const leadToContact = new Map(
    (leads ?? []).map((l) => [l.id as string, l.contact_id as string])
  );

  const counts = new Map<string, number>();
  if (!leadIds.length) return counts;

  const { data: logs } = await supabase.from("call_logs").select("lead_id").in("lead_id", leadIds);
  for (const log of logs ?? []) {
    const cid = leadToContact.get(log.lead_id as string);
    if (!cid) continue;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
  }
  return counts;
}

export type RelationshipCounts = {
  total: number;
  customers: number;
  pipeline: number;
  aware: number;
  cold: number;
};

export async function getRelationshipCounts(
  supabase: SupabaseClient,
  clientId: string
): Promise<RelationshipCounts> {
  const { data: contacts } = await supabase
    .from("contacts")
    .select("lifecycle")
    .eq("client_id", clientId);

  const counts: RelationshipCounts = {
    total: contacts?.length ?? 0,
    customers: 0,
    pipeline: 0,
    aware: 0,
    cold: 0,
  };

  for (const contact of contacts ?? []) {
    const lifecycle = String(contact.lifecycle);
    if (lifecycle === "customer") counts.customers++;
    else if (lifecycle === "pipeline") counts.pipeline++;
    else if (lifecycle === "aware") counts.aware++;
    else counts.cold++;
  }

  return counts;
}

export async function contactIdsForLifecycleFilter(
  supabase: SupabaseClient,
  clientId: string,
  lifecycle: ContactLifecycle
): Promise<Set<string>> {
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id")
    .eq("client_id", clientId)
    .eq("lifecycle", lifecycle);

  return new Set((contacts ?? []).map((c) => c.id as string));
}

export function parseLifecycleFilter(
  raw: string | null
): ContactLifecycle | "lead" | null {
  if (!raw) return null;
  if (raw === "lead") return "lead";
  return isContactLifecycle(raw) ? raw : null;
}

export async function contactIdsForHubFilter(
  supabase: SupabaseClient,
  clientId: string,
  filterKey: string
): Promise<Set<string> | null> {
  if (!filterKey) return null;

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, source, created_at")
    .eq("client_id", clientId);

  const rows = contacts ?? [];
  const callCounts = await callLogCountByContact(supabase, clientId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (filterKey === "never_contacted") {
    return new Set(
      rows
        .filter((c) => (callCounts.get(c.id as string) ?? 0) === 0)
        .map((c) => c.id as string)
    );
  }

  if (filterKey === "walk_in_no_logs") {
    return new Set(
      rows
        .filter((c) => {
          const created = new Date(c.created_at as string);
          return (
            normalizeSource(c.source as string | null) === "walk_in" &&
            created >= monthStart &&
            (callCounts.get(c.id as string) ?? 0) === 0
          );
        })
        .map((c) => c.id as string)
    );
  }

  if (filterKey === "out_of_budget_single") {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, contact_id")
      .eq("client_id", clientId)
      .not("contact_id", "is", null);

    const budgetReasons = new Set(["Budget too small", "Can't afford now", "Waiting on money"]);
    const matching = new Set<string>();

    for (const lead of leads ?? []) {
      const cid = lead.contact_id as string;
      if ((callCounts.get(cid) ?? 0) !== 1) continue;
      const { data: logs } = await supabase
        .from("call_logs")
        .select("outcome, reason")
        .eq("lead_id", lead.id as string);
      const hit = (logs ?? []).some(
        (cl) =>
          (cl.outcome === "NOT_QUALIFIED" && String(cl.reason ?? "").toLowerCase().includes("budget")) ||
          budgetReasons.has(String(cl.reason ?? ""))
      );
      if (hit) matching.add(cid);
    }
    return matching;
  }

  if (filterKey === "whatsapp_saved_slow") {
    return new Set(
      rows
        .filter((c) => normalizeSource(c.source as string | null) === "whatsapp_saved")
        .map((c) => c.id as string)
    );
  }

  if (filterKey === "referral_high_convert") {
    return new Set(
      rows
        .filter((c) => normalizeSource(c.source as string | null) === "referral")
        .map((c) => c.id as string)
    );
  }

  return null;
}

export { CONTACT_LIFECYCLES };
