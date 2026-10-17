import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactIdsForHubFilter, parseLifecycleFilter } from "@/lib/customer-hub/contact-filters";
import { enrichContactsWithLeads } from "@/lib/customer-hub/enrich-contacts-with-leads";
import { sanitizePostgrestSearchTerm } from "@/lib/security/postgrest-filter";
import { requireClientDataAccess } from "@/lib/security/support-access";
import { canViewBuyerInDirectory } from "@/lib/real-estate/buyer-contact-access";
import { loadBuyerContactAccessFacts } from "@/lib/real-estate/buyer-contact-access-service";

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
  const gate = await requireClientDataAccess({
    req,
    clientId: requestedClientId,
    scope: "CUSTOMER_PROFILES",
    resourceType: "contact_list",
  });
  if (gate.error) return gate.error;

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? String(PAGE_SIZE))));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const lifecycleRaw = url.searchParams.get("lifecycle");
  const lifecycle = parseLifecycleFilter(lifecycleRaw);
  const hubFilter = url.searchParams.get("hubFilter");
  // Phase 1 alias — prefer lifecycle=cold|aware
  const relationship = url.searchParams.get("relationship");
  const q = (url.searchParams.get("q") ?? "").trim();
  const qSafe = sanitizePostgrestSearchTerm(q);

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
  if (qSafe) query = query.or(`name.ilike.%${qSafe}%,phone.ilike.%${qSafe}%`);
  query = query.order("updated_at", { ascending: false }).range(from, to);

  const { data: contacts, count, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load contacts" }, { status: 500 });

  const rows = contacts ?? [];
  let visibleRows = rows;
  let hiddenOnPage = 0;
  if (session.role === "SALESPERSON" && rows.length) {
    const facts = await loadBuyerContactAccessFacts(
      requestedClientId,
      rows.map((row) => row.id as string)
    );
    if (!facts.ok) return NextResponse.json({ error: "Could not load contacts" }, { status: 503 });
    const actor = { id: session.userId, role: session.role, clientId: session.clientId };
    visibleRows = rows.filter((row) =>
      canViewBuyerInDirectory({
        actor,
        recordClientId: requestedClientId,
        contactId: row.id as string,
        searches: facts.searches,
      })
    );
    hiddenOnPage = rows.length - visibleRows.length;
  }

  const contactsOut = await enrichContactsWithLeads(supabase, visibleRows);

  const rawTotal = count ?? 0;
  const total = Math.max(0, rawTotal - hiddenOnPage);
  const hasMore = qSafe ? false : to < rawTotal - 1;

  return NextResponse.json({ contacts: contactsOut, total, page, limit, hasMore });
}
