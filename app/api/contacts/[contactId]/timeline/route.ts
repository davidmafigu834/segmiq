import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildContactTimeline } from "@/lib/customer-hub/build-contact-timeline";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { contactId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, client_id, source, created_at")
    .eq("id", params.contactId)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    session.role !== "AGENCY_ADMIN" &&
    !canAccessClient(session.role, session.clientId, contact.client_id as string)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const events = await buildContactTimeline(
    supabase,
    params.contactId,
    contact.created_at as string,
    contact.source as string | null
  );

  return NextResponse.json({ events });
}
