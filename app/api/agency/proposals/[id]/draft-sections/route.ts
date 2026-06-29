import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProposalAdmin } from "@/lib/proposals/access";
import { draftProposalSections } from "@/lib/ai/proposal-sections";

export const dynamic = "force-dynamic";

/**
 * Generate draft narrative sections for a proposal using Claude. Returns the
 * sections for the builder to drop in and edit — does not persist them.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI drafting is not configured" }, { status: 503 });
  }

  const supabase = createAdminClient();
  const { data: proposal } = await supabase
    .from("agency_proposals")
    .select("company_name, recipient_name, title, proposed_plan, submission_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let industry: string | null = null;
  let teamSize: string | null = null;
  let leadVolume: string | null = null;
  let market: string | null = null;
  let message: string | null = null;
  if (proposal.submission_id) {
    const { data: sub } = await supabase
      .from("marketing_submissions")
      .select("industry, team_size, lead_volume, market, message")
      .eq("id", proposal.submission_id as string)
      .maybeSingle();
    if (sub) {
      industry = (sub.industry as string | null) ?? null;
      teamSize = (sub.team_size as string | null) ?? null;
      leadVolume = (sub.lead_volume as string | null) ?? null;
      market = (sub.market as string | null) ?? null;
      message = (sub.message as string | null) ?? null;
    }
  }

  try {
    const sections = await draftProposalSections({
      companyName: proposal.company_name as string | null,
      recipientName: proposal.recipient_name as string | null,
      proposalTitle: proposal.title as string | null,
      proposedPlan: proposal.proposed_plan as string | null,
      industry,
      teamSize,
      leadVolume,
      market,
      message,
    });
    return NextResponse.json({ sections });
  } catch (err) {
    console.error("[proposal draft-sections] AI error:", err);
    return NextResponse.json({ error: "Failed to draft sections" }, { status: 500 });
  }
}
