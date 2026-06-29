import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProposalAdmin } from "@/lib/proposals/access";
import type { ProposalLineItemInput, ProposalSectionInput } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agency_proposal_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: Request) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    sections?: ProposalSectionInput[];
    default_line_items?: ProposalLineItemInput[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("agency_proposal_templates")
    .insert({
      name: body.name.trim(),
      description: body.description ?? null,
      sections: body.sections ?? [],
      default_line_items: body.default_line_items ?? [],
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}
