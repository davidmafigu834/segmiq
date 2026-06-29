import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProposalAdmin } from "@/lib/proposals/access";
import { saveItemsAndTotals, saveSections, loadProposalWithDetails } from "@/lib/proposals/persist";
import type { ProposalLineItemInput, ProposalSectionInput } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const full = await loadProposalWithDetails(supabase, params.id);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal: full });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const body = (await req.json()) as Partial<{
    company_name: string | null;
    recipient_name: string | null;
    recipient_email: string | null;
    recipient_phone: string | null;
    title: string;
    proposed_mode: "team" | "solo";
    proposed_plan: "starter" | "professional" | "business";
    billing_cycle: "monthly" | "annual";
    valid_until: string | null;
    notes: string | null;
    terms: string | null;
    discount: number;
    tax_rate: number;
    sections: ProposalSectionInput[];
    items: ProposalLineItemInput[];
  }>;

  const { data: current } = await supabase
    .from("agency_proposals")
    .select("discount, tax_rate")
    .eq("id", params.id)
    .single();
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    "company_name",
    "recipient_name",
    "recipient_email",
    "recipient_phone",
    "title",
    "proposed_mode",
    "proposed_plan",
    "billing_cycle",
    "valid_until",
    "notes",
    "terms",
  ] as const) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length > 1) {
    await supabase.from("agency_proposals").update(updates).eq("id", params.id);
  }

  if (body.sections !== undefined) {
    await saveSections(supabase, params.id, body.sections);
  }

  const discount = body.discount ?? (Number(current.discount) || 0);
  const taxRate = body.tax_rate ?? (Number(current.tax_rate) || 0);

  if (body.items !== undefined) {
    await saveItemsAndTotals(supabase, params.id, body.items, discount, taxRate);
  } else if (body.discount !== undefined || body.tax_rate !== undefined) {
    const { data: items } = await supabase
      .from("agency_proposal_line_items")
      .select("item_name, description, unit_price, quantity, group_label")
      .eq("proposal_id", params.id)
      .order("sort_order", { ascending: true });
    await saveItemsAndTotals(
      supabase,
      params.id,
      (items ?? []) as ProposalLineItemInput[],
      discount,
      taxRate
    );
  }

  const full = await loadProposalWithDetails(supabase, params.id);
  return NextResponse.json({ proposal: full });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const { data: proposal } = await supabase
    .from("agency_proposals")
    .select("status")
    .eq("id", params.id)
    .single();
  if (proposal && proposal.status !== "draft") {
    return NextResponse.json({ error: "Only draft proposals can be deleted" }, { status: 400 });
  }

  const { error } = await supabase.from("agency_proposals").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
