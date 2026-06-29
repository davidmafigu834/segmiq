import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  provisionClientFromProposal,
  notifyStaffOfProposalResponse,
} from "@/lib/proposals/provision";

export const dynamic = "force-dynamic";

const VIEW_FROM = new Set(["sent"]);
const RESPONDABLE = new Set(["sent", "viewed"]);

async function loadByToken(token: string) {
  const supabase = createAdminClient();
  const { data: proposal } = await supabase
    .from("agency_proposals")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  return { supabase, proposal };
}

/** Public proposal fetch — marks the proposal as viewed on first open. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const { supabase, proposal } = await loadByToken(params.token);
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Record the first view (sent -> viewed) without overwriting a later state.
  if (VIEW_FROM.has(proposal.status as string)) {
    await supabase
      .from("agency_proposals")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", proposal.id as string)
      .eq("status", "sent");
    proposal.status = "viewed";
  }

  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase
      .from("agency_proposal_sections")
      .select("kind, heading, body, sort_order")
      .eq("proposal_id", proposal.id as string)
      .order("sort_order", { ascending: true }),
    supabase
      .from("agency_proposal_line_items")
      .select("item_name, description, unit_price, quantity, amount, group_label, sort_order")
      .eq("proposal_id", proposal.id as string)
      .order("sort_order", { ascending: true }),
  ]);

  return NextResponse.json({
    proposal: {
      ...proposal,
      sections: sections ?? [],
      items: items ?? [],
    },
  });
}

/** Public accept / reject. On accept, auto-provision the tenant. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { supabase, proposal } = await loadByToken(params.token);
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action === "accept" ? "accept" : body.action === "reject" ? "reject" : null;
  if (!action) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const status = proposal.status as string;
  if (status === "accepted" || status === "rejected") {
    return NextResponse.json({ error: "This proposal has already been responded to" }, { status: 409 });
  }
  if (!RESPONDABLE.has(status)) {
    return NextResponse.json({ error: "This proposal cannot be responded to" }, { status: 409 });
  }
  if (proposal.valid_until && new Date(`${proposal.valid_until as string}T23:59:59`) < new Date()) {
    await supabase
      .from("agency_proposals")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", proposal.id as string);
    return NextResponse.json({ error: "This proposal has expired" }, { status: 410 });
  }

  const respondedAt = new Date().toISOString();
  const newStatus = action === "accept" ? "accepted" : "rejected";
  await supabase
    .from("agency_proposals")
    .update({ status: newStatus, responded_at: respondedAt, updated_at: respondedAt })
    .eq("id", proposal.id as string);

  const record = {
    id: proposal.id as string,
    proposal_number: (proposal.proposal_number as string | null) ?? null,
    title: (proposal.title as string | null) ?? null,
    company_name: (proposal.company_name as string | null) ?? null,
    recipient_name: (proposal.recipient_name as string | null) ?? null,
    recipient_email: (proposal.recipient_email as string | null) ?? null,
    submission_id: (proposal.submission_id as string | null) ?? null,
    client_id: (proposal.client_id as string | null) ?? null,
    proposed_mode: (proposal.proposed_mode as string | null) ?? null,
    proposed_plan: (proposal.proposed_plan as string | null) ?? null,
    billing_cycle: (proposal.billing_cycle as string | null) ?? null,
    currency: (proposal.currency as string | null) ?? null,
    total: (proposal.total as number | null) ?? null,
  };

  let provisioned = false;
  if (action === "accept") {
    try {
      const result = await provisionClientFromProposal(supabase, record);
      provisioned = result.provisioned;
    } catch (err) {
      console.error("[proposal accept] provisioning error:", err);
    }
  }

  // Notify staff (best-effort, non-blocking on the response).
  void notifyStaffOfProposalResponse(record, newStatus as "accepted" | "rejected", provisioned);

  return NextResponse.json({ success: true, status: newStatus });
}
