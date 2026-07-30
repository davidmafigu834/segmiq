import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactIdsForHubFilter, parseLifecycleFilter } from "@/lib/customer-hub/contact-filters";
import { enrichContactsWithLeads } from "@/lib/customer-hub/enrich-contacts-with-leads";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const g = await requireSession();
  if ("error" in g) return g.error;
  const { session } = g;

  const url = new URL(req.url);
  const requestedClientId =
    session.role === "SUPER_ADMIN" ? url.searchParams.get("clientId") : session.clientId;
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
  const lifecycleRaw = url.searchParams.get("lifecycle");
  const lifecycle = parseLifecycleFilter(lifecycleRaw);
  const hubFilter = url.searchParams.get("hubFilter");
  // Phase 1 alias — prefer lifecycle=cold|aware
  const relationship = url.searchParams.get("relationship");
  const q = (url.searchParams.get("q") ?? "").trim().replace(/[,()%*\\:]/g, "");

  const supabase = createAdminClient();

  const filterIds =
    hubFilter && session.role === "CLIENT_MANAGER"
      ? await contactIdsForHubFilter(supabase, requestedClientId, hubFilter)
      : null;

  let query = supabase
    .from("contacts")
    .select("id, name, phone, email, source, lifecycle, lead_origin, created_at, updated_at", {
      count: "exact",
    })
    .eq("client_id", requestedClientId);

  if (lifecycle && lifecycle !== "lead") {
    query = query.eq("lifecycle", lifecycle);
  } else if (lifecycle === "lead") {
    query = query.in("lifecycle", ["cold", "aware", "pipeline"]);
  } else if (relationship === "cold" || relationship === "aware") {
    query = query.eq("lifecycle", relationship);
  }
  if (filterIds) {
    if (filterIds.size === 0) {
      return NextResponse.json({ contacts: [], total: 0, page, limit, hasMore: false });
    }
    query = query.in("id", Array.from(filterIds));
  }
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  query = query.order("updated_at", { ascending: false }).range(from, to);

  const { data: contacts, count, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load contacts" }, { status: 500 });

  const rows = contacts ?? [];

  const contactsOut = await enrichContactsWithLeads(supabase, rows);

  const total = count ?? 0;

  return NextResponse.json({ contacts: contactsOut, total, page, limit, hasMore: to < total - 1 });
}
