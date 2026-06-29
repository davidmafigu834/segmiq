import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProposalAdmin } from "@/lib/proposals/access";
import { allocateProposalNumber } from "@/lib/proposals/proposal-number";
import { buildProposalPdfData } from "@/lib/proposals/build-pdf-data";
import { renderProposalPdf } from "@/lib/proposals/proposal-pdf";
import { putObject, getPublicUrl } from "@/lib/storage/r2";
import { sendEmail } from "@/lib/email/resend";
import { proposalLinkEmail } from "@/lib/email/templates/proposal-link";
import { getPublicBaseUrl } from "@/lib/constants";
import { formatMoney } from "@/lib/proposals/totals";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const { data: proposal } = await supabase
    .from("agency_proposals")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!proposal.recipient_email) {
    return NextResponse.json({ error: "Add a recipient email before sending" }, { status: 400 });
  }

  // Allocate a proposal number on first send; keep it stable on re-sends.
  let proposalNumber = (proposal.proposal_number as string | null) ?? null;
  if (!proposalNumber) {
    proposalNumber = await allocateProposalNumber(supabase);
  }

  // Ensure a public token exists for the hosted link.
  let publicToken = (proposal.public_token as string | null) ?? null;
  if (!publicToken) {
    const { randomBytes } = await import("crypto");
    publicToken = randomBytes(32).toString("hex");
  }

  const sentAt = new Date().toISOString();
  await supabase
    .from("agency_proposals")
    .update({
      proposal_number: proposalNumber,
      public_token: publicToken,
      status: "sent",
      sent_at: sentAt,
      updated_at: sentAt,
    })
    .eq("id", params.id);

  // Render branded PDF and store on R2.
  const pdfData = await buildProposalPdfData(supabase, params.id);
  if (!pdfData) return NextResponse.json({ error: "Failed to assemble proposal" }, { status: 500 });

  let pdfUrl: string;
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderProposalPdf(pdfData);
    const key = `agency/proposals/${proposalNumber}-${Date.now()}.pdf`;
    await putObject(key, pdfBuffer, "application/pdf");
    pdfUrl = getPublicUrl(key);
    await supabase
      .from("agency_proposals")
      .update({ pdf_url: pdfUrl, pdf_key: key, updated_at: new Date().toISOString() })
      .eq("id", params.id);
  } catch (err) {
    console.error("[proposal send] PDF/R2 error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  // Email the hosted link (with the PDF attached) to the prospect.
  const link = `${getPublicBaseUrl()}/proposal/${publicToken}`;
  const { subject, html } = proposalLinkEmail({
    link,
    recipientName: proposal.recipient_name as string | null,
    companyName: proposal.company_name as string | null,
    proposalTitle: (proposal.title as string | null) || "Proposal",
    validUntil: proposal.valid_until as string | null,
  });
  const emailResult = await sendEmail({
    to: proposal.recipient_email as string,
    subject,
    html,
    attachments: [{ filename: `proposal-${proposalNumber}.pdf`, content: pdfBuffer }],
  });
  if (!emailResult.success) {
    console.error("[proposal send] email failed:", emailResult.error);
  }

  const total = formatMoney(Number(proposal.total) || 0, (proposal.currency as string) || "USD");
  const firstName = (proposal.recipient_name as string | null)?.split(" ")[0] || "there";
  const waMessage = `Hi ${firstName}, here is your proposal ${proposalNumber} from ${pdfData.companyName} — total ${total}. View and respond here: ${link}`;

  return NextResponse.json({
    success: true,
    pdfUrl,
    proposalNumber,
    link,
    emailSent: emailResult.success,
    waMessage,
  });
}
