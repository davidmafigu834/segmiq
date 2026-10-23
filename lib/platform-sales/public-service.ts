import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashRecipientToken } from "@/lib/platform-sales/tokens";
import { generatePresignedDownloadUrl } from "@/lib/storage/r2";

export async function openPlatformOffer(rawToken: string) {
  const { data, error } = await createAdminClient().rpc(
    "platform_get_sales_quote_by_token",
    {
      p_token_hash: hashRecipientToken(rawToken),
      p_correlation_id: randomUUID(),
    },
  );
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}
export async function respondToPlatformOffer(
  rawToken: string,
  input: {
    action: string;
    name?: string;
    title?: string;
    authorityConfirmed: boolean;
    correlationId: string;
  },
) {
  const { data, error } = await createAdminClient().rpc(
    "platform_respond_sales_quote",
    {
      p_token_hash: hashRecipientToken(rawToken),
      p_action: input.action,
      p_name: input.name ?? null,
      p_title: input.title ?? null,
      p_authority_confirmed: input.authorityConfirmed,
      p_correlation_id: input.correlationId,
    },
  );
  if (error) throw new Error(error.message);
  return String(data);
}
export async function recipientQuoteDownload(rawToken: string) {
  const db = createAdminClient();
  const hash = hashRecipientToken(rawToken);
  const { data: link } = await db
    .from("platform_sales_quote_links")
    .select("quote_id,revision,expires_at,redeemed_at,revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (
    !link ||
    link.revoked_at ||
    link.redeemed_at ||
    new Date(link.expires_at as string) <= new Date()
  )
    throw new Error("Link is not active");
  const { data: revision } = await db
    .from("platform_sales_quote_revisions")
    .select("pdf_object_key")
    .eq("quote_id", link.quote_id)
    .eq("revision", link.revision)
    .maybeSingle();
  const { data: quote } = await db
    .from("platform_sales_quotes")
    .select("quote_number,current_revision")
    .eq("id", link.quote_id)
    .maybeSingle();
  if (
    !revision?.pdf_object_key ||
    !quote ||
    Number(quote.current_revision) !== Number(link.revision)
  )
    throw new Error("PDF unavailable");
  return generatePresignedDownloadUrl(
    String(revision.pdf_object_key),
    `${quote.quote_number}.pdf`,
    "application/pdf",
  );
}
