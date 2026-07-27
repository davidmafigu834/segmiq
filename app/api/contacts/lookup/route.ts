import { NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;

  const { session } = g;
  const { searchParams } = new URL(req.url);
  const rawPhone = (searchParams.get("phone") || "").trim();
  const queryClientId = searchParams.get("clientId");

  const requestedClientId =
    session.role === "AGENCY_ADMIN" ? queryClientId : session.clientId;

  if (!requestedClientId) {
    return NextResponse.json({ error: "Missing client context" }, { status: 400 });
  }
  if (!canAccessClient(session.role, session.clientId, requestedClientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!rawPhone) {
    return NextResponse.json({ match: null });
  }

  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("dial_code")
    .eq("id", requestedClientId)
    .single();

  const wa = normalizePhoneForWhatsApp(rawPhone, client?.dial_code || "263");
  if (!wa) {
    return NextResponse.json({ match: null });
  }
  const normalized = "+" + wa;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, lifecycle")
    .eq("client_id", requestedClientId)
    .eq("phone", normalized)
    .limit(1)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json({ match: null });
  }

  const { data: latestLead } = await supabase
    .from("leads")
    .select("id, status, updated_at, assigned_to_id, assigned_to:users!assigned_to_id ( id, name )")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const a = latestLead?.assigned_to as
    | { id?: string; name?: string }
    | { id?: string; name?: string }[]
    | null
    | undefined;
  const assignee = Array.isArray(a) ? a[0] ?? null : a;
  const ownerId = assignee?.id ?? latestLead?.assigned_to_id ?? null;
  const owner = assignee?.name ?? null;

  return NextResponse.json({
    match: {
      id: contact.id,
      name: contact.name,
      lifecycle: contact.lifecycle,
      owner,
      ownerId,
      ownedByYou: Boolean(ownerId && session.userId && ownerId === session.userId),
      leadId: latestLead?.id ?? null,
      leadStatus: latestLead?.status ?? null,
      lastTouchedAt: latestLead?.updated_at ?? null,
    },
  });
}
