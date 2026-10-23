import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function listPlatformProspects() {
  const { data, error } = await createAdminClient()
    .from("platform_sales_prospects")
    .select(
      "id,organisation_name,legal_name,trading_name,industry,contact_name,contact_position,email,phone,status,converted_client_id,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}
export async function listPlatformQuotes() {
  const { data, error } = await createAdminClient()
    .from("platform_sales_quotes")
    .select(
      "id,prospect_id,quote_number,current_revision,status,valid_until,created_at,updated_at,platform_sales_prospects(organisation_name)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}
export async function loadPlatformQuoteForPdf(quoteId: string) {
  const db = createAdminClient();
  const { data: quote, error } = await db
    .from("platform_sales_quotes")
    .select(
      "id,quote_number,current_revision,valid_until,status,platform_sales_prospects(organisation_name,legal_name,contact_name,email,phone)",
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (error || !quote) throw new Error(error?.message ?? "Quote not found");
  const { data: revision, error: revisionError } = await db
    .from("platform_sales_quote_revisions")
    .select(
      "revision,pricing_snapshot,commercial_notes,pdf_object_key,pdf_sha256,status",
    )
    .eq("quote_id", quoteId)
    .eq("revision", quote.current_revision)
    .maybeSingle();
  if (revisionError || !revision)
    throw new Error(revisionError?.message ?? "Quote revision not found");
  return { quote, revision };
}
