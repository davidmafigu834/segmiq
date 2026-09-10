import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProposalSettings } from "@/lib/proposals/proposal-number";
import { PublicProposalView, type PublicProposalData } from "@/components/proposals/PublicProposalView";
import { buildPublicProposalPayload, PUBLIC_PROPOSAL_SELECT } from "@/lib/proposals/public-payload";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5] px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-[#09090b]">Proposal not found</h1>
        <p className="mt-3 text-sm text-[#52525b]">
          This proposal link is invalid or has been removed. Please contact us for an up-to-date link.
        </p>
      </div>
    </div>
  );
}

export default async function PublicProposalPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { data: proposal } = await supabase
    .from("agency_proposals")
    .select(PUBLIC_PROPOSAL_SELECT)
    .eq("public_token", params.token)
    .maybeSingle();

  if (!proposal) return <NotFound />;

  // Record the first view (sent -> viewed).
  if (proposal.status === "sent") {
    await supabase
      .from("agency_proposals")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", proposal.id as string)
      .eq("status", "sent");
    proposal.status = "viewed";
  }

  const [{ data: sections }, { data: items }, settings] = await Promise.all([
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
    ensureProposalSettings(supabase),
  ]);

  const expired =
    !!proposal.valid_until &&
    new Date(`${proposal.valid_until as string}T23:59:59`) < new Date() &&
    proposal.status !== "accepted" &&
    proposal.status !== "rejected";

  const data: PublicProposalData = buildPublicProposalPayload({
    token: params.token,
    proposal: {
      ...(proposal as Record<string, unknown>),
      status: expired ? "expired" : proposal.status,
    },
    sections: (sections ?? []) as Array<Record<string, unknown>>,
    items: (items ?? []) as Array<Record<string, unknown>>,
    brand: {
      companyName: (settings.company_name as string | null) || "Segmiq",
      logoUrl: (settings.logo_url as string | null) ?? null,
      brandColor: (settings.brand_color as string | null) || "#0F7A4F",
      companyEmail: (settings.company_email as string | null) ?? null,
      companyPhone: (settings.company_phone as string | null) ?? null,
      footerNote: (settings.footer_note as string | null) ?? null,
    },
  });

  return <PublicProposalView data={data} />;
}
