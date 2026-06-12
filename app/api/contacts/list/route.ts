import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const g = await requireSession();
  if ("error" in g) return g.error;
  const { session } = g;

  const url = new URL(req.url);
  const requestedClientId =
    session.role === "AGENCY_ADMIN" ? url.searchParams.get("clientId") : session.clientId;
  if (!requestedClientId) {
    return NextResponse.json({ error: "Missing client context" }, { status: 400 });
  }
  if (!canAccessClient(session.role, session.clientId, requestedClientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? String(PAGE_SIZE))));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const lifecycle = url.searchParams.get("lifecycle"); // 'lead' | 'customer' | null
  const q = (url.searchParams.get("q") ?? "").trim().replace(/[,()%*\\:]/g, "");

  const supabase = createAdminClient();

  let query = supabase
    .from("contacts")
    .select("id, name, phone, email, source, lifecycle, lead_origin, created_at, updated_at", {
      count: "exact",
    })
    .eq("client_id", requestedClientId);

  if (lifecycle === "lead" || lifecycle === "customer") query = query.eq("lifecycle", lifecycle);
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  query = query.order("updated_at", { ascending: false }).range(from, to);

  const { data: contacts, count, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load contacts" }, { status: 500 });

  const rows = contacts ?? [];
  const ids = rows.map((c) => c.id);

  const ownerByContact = new Map<string, { owner: string | null; lastTouchedAt: string | null }>();
  if (ids.length) {
    const { data: leadRows } = await supabase
      .from("leads")
      .select("contact_id, updated_at, assigned_to:users!assigned_to_id ( id, name )")
      .in("contact_id", ids)
      .order("created_at", { ascending: false });
    for (const lr of leadRows ?? []) {
      if (!lr.contact_id || ownerByContact.has(lr.contact_id)) continue;
      const a = lr.assigned_to as { name?: string } | { name?: string }[] | null | undefined;
      const owner = Array.isArray(a) ? (a[0]?.name ?? null) : (a?.name ?? null);
      ownerByContact.set(lr.contact_id, { owner, lastTouchedAt: lr.updated_at ?? null });
    }
  }

  const total = count ?? 0;
  const contactsOut = rows.map((c) => ({
    ...c,
    owner: ownerByContact.get(c.id)?.owner ?? null,
    lastTouchedAt: ownerByContact.get(c.id)?.lastTouchedAt ?? c.updated_at,
  }));

  return NextResponse.json({ contacts: contactsOut, total, page, limit, hasMore: to < total - 1 });
}
