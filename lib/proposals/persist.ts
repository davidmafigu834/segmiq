import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposalLineItemInput, ProposalSectionInput } from "@/types";
import { computeProposalTotals, lineAmount } from "@/lib/proposals/totals";

/**
 * Replace a proposal's line items and recompute + persist its totals.
 * Returns the computed totals.
 */
export async function saveItemsAndTotals(
  supabase: SupabaseClient,
  proposalId: string,
  items: ProposalLineItemInput[],
  discount: number,
  taxRate: number
): Promise<{ subtotal: number; taxAmount: number; total: number }> {
  const clean = items
    .filter((it) => (it.item_name ?? "").trim().length > 0)
    .map((it, idx) => ({
      proposal_id: proposalId,
      item_name: it.item_name.trim(),
      description: it.description?.trim() || null,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 0,
      amount: lineAmount(it.unit_price, it.quantity),
      group_label: it.group_label?.trim() || null,
      sort_order: idx,
    }));

  await supabase.from("agency_proposal_line_items").delete().eq("proposal_id", proposalId);
  if (clean.length > 0) {
    await supabase.from("agency_proposal_line_items").insert(clean);
  }

  const totals = computeProposalTotals(clean, discount, taxRate);
  await supabase
    .from("agency_proposals")
    .update({
      subtotal: totals.subtotal,
      discount: Number(discount) || 0,
      tax_rate: Number(taxRate) || 0,
      tax_amount: totals.taxAmount,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId);

  return totals;
}

/** Replace a proposal's narrative sections, preserving order. */
export async function saveSections(
  supabase: SupabaseClient,
  proposalId: string,
  sections: ProposalSectionInput[]
): Promise<void> {
  const clean = sections
    .filter((s) => (s.heading ?? "").trim().length > 0 || (s.body ?? "").trim().length > 0)
    .map((s, idx) => ({
      proposal_id: proposalId,
      kind: s.kind ?? "custom",
      heading: s.heading?.trim() || null,
      body: s.body?.trim() || null,
      sort_order: idx,
    }));

  await supabase.from("agency_proposal_sections").delete().eq("proposal_id", proposalId);
  if (clean.length > 0) {
    await supabase.from("agency_proposal_sections").insert(clean);
  }
}

export async function loadProposalWithDetails(
  supabase: SupabaseClient,
  proposalId: string
): Promise<Record<string, unknown> | null> {
  const { data: proposal } = await supabase
    .from("agency_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return null;

  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase
      .from("agency_proposal_sections")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("agency_proposal_line_items")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("sort_order", { ascending: true }),
  ]);

  return { ...proposal, sections: sections ?? [], items: items ?? [] };
}
