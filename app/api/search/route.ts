import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { sanitizePostgrestSearchTerm } from "@/lib/security/postgrest-filter";

export const dynamic = "force-dynamic";

function statusLabel(status: string): string {
  return String(status).replaceAll("_", " ").toLowerCase();
}

function roleLabel(role: string): string {
  return String(role).replaceAll("_", " ").toLowerCase();
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const qRaw = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!qRaw.length) {
    return NextResponse.json({ results: [] });
  }
  const q = sanitizePostgrestSearchTerm(qRaw);
  if (!q.length) {
    return NextResponse.json({ results: [] });
  }
  const pattern = `%${q}%`;

  const supabase = createAdminClient();
  const role = session.role as UserRole;
  const userId = session.userId;
  const clientId = session.clientId ?? null;
  // SECURITY: impersonation must never inherit platform-wide search.
  const isPlatformAdmin = role === "SUPER_ADMIN" && !session.isImpersonating;

  type Row = {
    type: "lead" | "client" | "user";
    id: string;
    title: string;
    subtitle: string;
    meta?: string;
    href: string;
  };
  const results: Row[] = [];

  const salesScoped = canActAsSalesperson({ userId, role, alsoSells: session.alsoSells });

  /**
   * SECURITY: platform search covers the platform — organisations, tenant ids and
   * organisation staff. It must never become a cross-tenant customer lookup: a
   * SegmiQ employee typing a phone number must not discover every organisation
   * where that person appears. Customer records are reachable only through an
   * organisation with an active Support Access grant.
   */
  if (!isPlatformAdmin) {
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let leadsQ = supabase
      .from("leads")
      .select("id, name, phone, email, status, client_id, clients(name, slug)")
      .eq("is_archived", false)
      .or(`name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
      .eq("client_id", clientId)
      .limit(8);
    if (salesScoped) {
      leadsQ = leadsQ.eq("assigned_to_id", userId);
    }

    const { data: leads } = await leadsQ;
    for (const lead of leads ?? []) {
      const cl = (lead as { clients?: { name?: string; slug?: string } | null }).clients;
      const href = salesScoped
        ? `/sales/leads?lead=${lead.id}`
        : `/client/leads/pipeline?lead=${lead.id}`;
      results.push({
        type: "lead",
        id: lead.id as string,
        title: (lead.name as string | null)?.trim() || "Unnamed lead",
        subtitle: [lead.phone, cl?.name].filter(Boolean).join(" · "),
        meta: statusLabel(String(lead.status)),
        href,
      });
    }
  }

  if (isPlatformAdmin) {
    // Tenant id lookups are part of platform operations, so an exact id matches too.
    const idMatch = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qRaw)
      ? qRaw
      : null;
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, slug, industry")
      .eq("is_archived", false)
      .or(
        [
          `name.ilike.${pattern}`,
          `slug.ilike.${pattern}`,
          ...(idMatch ? [`id.eq.${idMatch}`] : []),
        ].join(",")
      )
      .limit(5);
    for (const client of clients ?? []) {
      results.push({
        type: "client",
        id: client.id as string,
        title: client.name as string,
        subtitle: (client.industry as string) || "No industry set",
        href: `/dashboard/clients/${client.id}`,
      });
    }
  }

  if (isPlatformAdmin || role === "CLIENT_MANAGER") {
    let usersQ = supabase
      .from("users")
      .select("id, name, email, role, client_id, clients(name)")
      .eq("is_active", true)
      .in("role", ["SALESPERSON", "CLIENT_MANAGER"])
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(6);
    // SECURITY: managers without a tenant context must not see all users.
    if (!isPlatformAdmin) {
      if (!clientId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      usersQ = usersQ.eq("client_id", clientId);
    }
    const { data: users } = await usersQ;
    for (const user of users ?? []) {
      const u = user as { id: string; name: string; email: string; role: string; client_id: string | null; clients?: { name?: string } | null };
      const clientName = u.clients?.name;
      const href =
        isPlatformAdmin && u.client_id
          ? `/dashboard/clients/${u.client_id}/team`
          : "/client/team";
      results.push({
        type: "user",
        id: u.id,
        title: u.name,
        subtitle: [u.email, clientName, roleLabel(u.role)].filter(Boolean).join(" · "),
        href,
      });
    }
  }

  return NextResponse.json({ results });
}
