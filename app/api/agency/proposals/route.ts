import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { addDays, format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProposalAdmin } from "@/lib/proposals/access";
import { ensureProposalSettings } from "@/lib/proposals/proposal-number";
import { saveItemsAndTotals, saveSections, loadProposalWithDetails } from "@/lib/proposals/persist";
import type { ProposalLineItemInput, ProposalSectionInput } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agency_proposals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: data ?? [] });
}

type CreateBody = {
  submission_id?: string | null;
  company_name?: string | null;
  recipient_name?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  title?: string;
  proposed_mode?: "team" | "solo";
  proposed_plan?: "starter" | "professional" | "business";
  billing_cycle?: "monthly" | "annual";
  template_id?: string | null;
};

export async function POST(req: Request) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const body = (await req.json().catch(() => ({}))) as CreateBody;

  // Prefill recipient details from a marketing submission when linked.
  let company = body.company_name ?? null;
  let recipientName = body.recipient_name ?? null;
  let recipientEmail = body.recipient_email ?? null;
  let recipientPhone = body.recipient_phone ?? null;
  if (body.submission_id) {
    const { data: sub } = await supabase
      .from("marketing_submissions")
      .select("name, email, phone, company")
      .eq("id", body.submission_id)
      .maybeSingle();
    if (sub) {
      company = company ?? (sub.company as string | null);
      recipientName = recipientName ?? (sub.name as string | null);
      recipientEmail = recipientEmail ?? (sub.email as string | null);
      recipientPhone = recipientPhone ?? (sub.phone as string | null);
    }
  }

  const settings = await ensureProposalSettings(supabase);
  const validityDays = Number(settings.default_validity_days) || 30;
  const taxRate = Number(settings.default_tax_rate) || 0;

  const { data: proposal, error } = await supabase
    .from("agency_proposals")
    .insert({
      submission_id: body.submission_id ?? null,
      company_name: company,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      recipient_phone: recipientPhone,
      title: body.title?.trim() || "Proposal",
      status: "draft",
      public_token: randomBytes(32).toString("hex"),
      proposed_mode: body.proposed_mode ?? "team",
      proposed_plan: body.proposed_plan ?? "starter",
      billing_cycle: body.billing_cycle ?? "monthly",
      tax_rate: taxRate,
      valid_until: format(addDays(new Date(), validityDays), "yyyy-MM-dd"),
      terms: (settings.default_terms as string | null) ?? null,
      prepared_by_id: access.actor.id,
      prepared_by_name: access.actor.name,
    })
    .select("*")
    .single();

  if (error || !proposal) {
    return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 500 });
  }

  // Seed sections / line items from a template when provided.
  if (body.template_id) {
    const { data: tpl } = await supabase
      .from("agency_proposal_templates")
      .select("sections, default_line_items")
      .eq("id", body.template_id)
      .maybeSingle();
    if (tpl) {
      const sections = (tpl.sections as ProposalSectionInput[] | null) ?? [];
      const lineItems = (tpl.default_line_items as ProposalLineItemInput[] | null) ?? [];
      if (sections.length) await saveSections(supabase, proposal.id as string, sections);
      if (lineItems.length) {
        await saveItemsAndTotals(supabase, proposal.id as string, lineItems, 0, taxRate);
      }
    }
  }

  const full = await loadProposalWithDetails(supabase, proposal.id as string);
  return NextResponse.json({ proposal: full }, { status: 201 });
}
