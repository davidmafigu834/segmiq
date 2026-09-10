import type { PublicProposalData } from "@/components/proposals/PublicProposalView";

export const PUBLIC_PROPOSAL_SELECT = "id, title, proposal_number, company_name, recipient_name, currency, valid_until, subtotal, discount, tax_rate, tax_amount, total, terms, pdf_url, status, public_token, viewed_at, responded_at, updated_at";

export const PUBLIC_PROPOSAL_ACTION_SELECT = "id, title, proposal_number, company_name, recipient_name, currency, valid_until, subtotal, discount, tax_rate, tax_amount, total, terms, pdf_url, status, public_token, viewed_at, responded_at, updated_at, recipient_email, submission_id, client_id, proposed_mode, proposed_plan, billing_cycle";

type ProposalRow = Record<string, unknown>;

export function buildPublicProposalPayload(opts: {
  token: string;
  proposal: ProposalRow;
  sections: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
  brand: PublicProposalData["brand"];
}): PublicProposalData {
  return {
    token: opts.token,
    status: opts.proposal.status as PublicProposalData["status"],
    title: (opts.proposal.title as string | null) || "Proposal",
    proposalNumber: (opts.proposal.proposal_number as string | null) ?? null,
    companyName: (opts.proposal.company_name as string | null) ?? null,
    recipientName: (opts.proposal.recipient_name as string | null) ?? null,
    currency: (opts.proposal.currency as string | null) || "USD",
    validUntil: (opts.proposal.valid_until as string | null) ?? null,
    subtotal: Number(opts.proposal.subtotal) || 0,
    discount: Number(opts.proposal.discount) || 0,
    taxRate: Number(opts.proposal.tax_rate) || 0,
    taxAmount: Number(opts.proposal.tax_amount) || 0,
    total: Number(opts.proposal.total) || 0,
    terms: (opts.proposal.terms as string | null) ?? null,
    pdfUrl: (opts.proposal.pdf_url as string | null) ?? null,
    sections: opts.sections.map((s) => ({
      kind: s.kind as string,
      heading: (s.heading as string | null) ?? null,
      body: (s.body as string | null) ?? null,
    })),
    items: opts.items.map((it) => ({
      item_name: it.item_name as string,
      description: (it.description as string | null) ?? null,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 0,
      amount: Number(it.amount) || 0,
      group_label: (it.group_label as string | null) ?? null,
    })),
    brand: opts.brand,
  };
}
