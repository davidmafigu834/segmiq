import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposalPdfData } from "@/lib/proposals/proposal-pdf";
import { ensureProposalSettings } from "@/lib/proposals/proposal-number";

async function fetchLogoDataUri(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null; // guard against huge files
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Assemble everything the proposal PDF renderer needs from the stored proposal
 * + its sections + line items + Segmiq's own (agency) proposal settings.
 */
export async function buildProposalPdfData(
  supabase: SupabaseClient,
  proposalId: string
): Promise<ProposalPdfData | null> {
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

  const settings = await ensureProposalSettings(supabase);
  const logoDataUri = await fetchLogoDataUri((settings.logo_url as string | null) ?? null);

  return {
    brandColor: (settings.brand_color as string | null) || "#0F7A4F",
    logoDataUri,
    companyName: (settings.company_name as string | null) || "Segmiq",
    companyAddress: (settings.company_address as string | null) ?? null,
    companyPhone: (settings.company_phone as string | null) ?? null,
    companyEmail: (settings.company_email as string | null) ?? null,
    companyWebsite: (settings.company_website as string | null) ?? null,

    proposalNumber: (proposal.proposal_number as string | null) || "DRAFT",
    title: (proposal.title as string | null) || "Proposal",
    issuedAt: proposal.sent_at ? new Date(proposal.sent_at as string) : new Date(),
    validUntil: proposal.valid_until ? new Date(`${proposal.valid_until as string}T12:00:00`) : null,
    preparedBy: (proposal.prepared_by_name as string | null) ?? null,

    recipientCompany: (proposal.company_name as string | null) ?? null,
    recipientName: (proposal.recipient_name as string | null) ?? null,
    recipientEmail: (proposal.recipient_email as string | null) ?? null,
    recipientPhone: (proposal.recipient_phone as string | null) ?? null,

    sections: (sections ?? []).map((s) => ({
      kind: s.kind as string,
      heading: (s.heading as string | null) ?? null,
      body: (s.body as string | null) ?? null,
    })),

    currency: (proposal.currency as string | null) || "USD",
    items: (items ?? []).map((it) => ({
      item_name: it.item_name as string,
      description: (it.description as string | null) ?? null,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 0,
      amount: Number(it.amount) || 0,
      group_label: (it.group_label as string | null) ?? null,
    })),
    subtotal: Number(proposal.subtotal) || 0,
    discount: Number(proposal.discount) || 0,
    taxRate: Number(proposal.tax_rate) || 0,
    taxAmount: Number(proposal.tax_amount) || 0,
    total: Number(proposal.total) || 0,

    notes: (proposal.notes as string | null) ?? null,
    terms: (proposal.terms as string | null) ?? null,
    footerNote: (settings.footer_note as string | null) ?? null,
  };
}
