import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadListing } from "@/lib/real-estate/listing-access";
import { readPrivateDocument } from "@/lib/real-estate/private-document-storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string; documentId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  const supabase = createAdminClient();
  const { data: submission } = await supabase.from("re_journey_submissions").select("id, storage_key, link_id").eq("id", params.documentId).eq("client_id", params.clientId).maybeSingle();
  if (!submission?.storage_key) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const { data: link } = await supabase.from("re_journey_links").select("listing_id").eq("id", submission.link_id as string).eq("client_id", params.clientId).maybeSingle();
  const { data: listing } = link?.listing_id
    ? await supabase.from("listings").select("id, client_id, agent_id, approval_status").eq("id", link.listing_id as string).eq("client_id", params.clientId).maybeSingle()
    : { data: null };
  if (!listing || !canReadListing({ userId: guard.session.userId, role: guard.session.role, clientId: guard.session.clientId }, listing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const bytes = await readPrivateDocument(submission.storage_key as string);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The signed PDF is not available." }, { status: 404 });
  }
}
