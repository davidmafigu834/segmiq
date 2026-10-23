import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCanonicalCatalogue } from "@/lib/commercial/catalogue-repository";
import { calculatePlatformQuote } from "@/lib/platform-sales/pricing";
import type { QuoteInput } from "@/lib/platform-sales/types";
import {
  createRecipientToken,
  hashDocument,
} from "@/lib/platform-sales/tokens";
import {
  deleteObject,
  generatePlatformSalesQuoteKey,
  generatePresignedDownloadUrl,
  putObject,
} from "@/lib/storage/r2";
import { loadPlatformQuoteForPdf } from "@/lib/platform-sales/repository";
import { renderPlatformSalesQuotePdf } from "@/lib/platform-sales/quote-pdf";

export async function previewPlatformQuote(
  input: QuoteInput,
  actorUserId: string,
) {
  return calculatePlatformQuote(
    await loadCanonicalCatalogue({ forNewOffer: true }),
    input,
    actorUserId,
  );
}

export async function createPlatformQuote(
  input: QuoteInput & { prospectId: string },
  actorUserId: string,
) {
  const snapshot = await previewPlatformQuote(input, actorUserId);
  const contentSha256 = hashDocument(
    Buffer.from(
      JSON.stringify({
        prospectId: input.prospectId,
        validUntil: input.validUntil,
        notes: input.notes ?? null,
        snapshot,
      }),
    ),
  );
  const { data, error } = await createAdminClient().rpc(
    "platform_create_sales_quote",
    {
      p_prospect_id: input.prospectId,
      p_actor_user_id: actorUserId,
      p_snapshot: snapshot,
      p_valid_until: input.validUntil,
      p_notes: input.notes ?? null,
      p_content_sha256: contentSha256,
      p_correlation_id: randomUUID(),
    },
  );
  if (error) throw new Error(error.message);
  return { quoteId: String(data), snapshot };
}

export async function issuePlatformQuote(
  quoteId: string,
  actorUserId: string,
  baseUrl: string,
) {
  const { quote, revision } = await loadPlatformQuoteForPdf(quoteId);
  if (revision.status !== "draft")
    throw new Error("Only a draft revision can be issued");
  const prospect = quote.platform_sales_prospects as unknown as {
    organisation_name: string;
    contact_name: string;
  };
  const pdf = await renderPlatformSalesQuotePdf({
    quoteNumber: String(quote.quote_number),
    organisationName: prospect.organisation_name,
    contactName: prospect.contact_name,
    validUntil: String(quote.valid_until),
    snapshot: revision.pricing_snapshot as never,
    notes: revision.commercial_notes as string | null,
  });
  const key = generatePlatformSalesQuoteKey(quoteId, Number(revision.revision));
  const pdfSha256 = hashDocument(pdf);
  await putObject(key, pdf, "application/pdf", {
    contentDisposition: `attachment; filename="${quote.quote_number}.pdf"`,
    cacheControl: "private, no-store",
  });
  const token = createRecipientToken();
  const expiresAt = new Date(`${quote.valid_until}T23:59:59.999Z`);
  try {
    const { error } = await createAdminClient().rpc(
      "platform_issue_sales_quote",
      {
        p_quote_id: quoteId,
        p_actor_user_id: actorUserId,
        p_pdf_object_key: key,
        p_pdf_sha256: pdfSha256,
        p_token_hash: token.hash,
        p_token_expires_at: expiresAt.toISOString(),
        p_correlation_id: randomUUID(),
      },
    );
    if (error) throw new Error(error.message);
  } catch (error) {
    await deleteObject(key).catch(() => undefined);
    throw error;
  }
  return {
    recipientUrl: `${baseUrl.replace(/\/$/, "")}/offer/${token.raw}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function revisePlatformQuote(
  quoteId: string,
  input: QuoteInput,
  actorUserId: string,
) {
  const snapshot = await previewPlatformQuote(input, actorUserId);
  const contentSha256 = hashDocument(
    Buffer.from(
      JSON.stringify({
        quoteId,
        validUntil: input.validUntil,
        notes: input.notes ?? null,
        snapshot,
      }),
    ),
  );
  const { data, error } = await createAdminClient().rpc(
    "platform_revise_sales_quote",
    {
      p_quote_id: quoteId,
      p_actor_user_id: actorUserId,
      p_snapshot: snapshot,
      p_valid_until: input.validUntil,
      p_notes: input.notes ?? null,
      p_content_sha256: contentSha256,
      p_correlation_id: randomUUID(),
    },
  );
  if (error) throw new Error(error.message);
  return { quoteId, revision: Number(data), snapshot };
}

export async function adminQuoteDownload(quoteId: string) {
  const { quote, revision } = await loadPlatformQuoteForPdf(quoteId);
  if (!revision.pdf_object_key) throw new Error("PDF has not been issued");
  return generatePresignedDownloadUrl(
    String(revision.pdf_object_key),
    `${quote.quote_number}.pdf`,
    "application/pdf",
  );
}
