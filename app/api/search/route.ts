import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/%/g, "").replace(/,/g, "").trim();
}

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
  const q = esc(qRaw);
  if (!q.length) {
    return NextResponse.json({ results: [] });
  }
  const pattern = `%${q}%`;

  const supabase = createAdminClient();
  const role = session.role as UserRole;
  const userId = session.userId;
  const clientId = session.clientId ?? null;

  type Row = {
    type: "lead" | "client" | "user";
    id: string;
    title: string;
    subtitle: string;
    meta?: string;
    href: string;
  };
  const results: Row[] = [];

  let leadsQ = supabase
    .from("leads")
    .select("id, name, phone, email, status, client_id, clients(name, slug)")
    .eq("is_archived", false)
    .or(`name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
    .limit(8);

  const salesScoped = canActAsSalesperson({ userId, role, alsoSells: session.alsoSells });

  if (role === "CLIENT_MANAGER" && clientId && !salesScoped) {
    leadsQ = leadsQ.eq("client_id", clientId);
  }
  if (salesScoped) {
    leadsQ = leadsQ.eq("assigned_to_id", userId);
  }

  const { data: leads } = await leadsQ;
  for (const lead of leads ?? []) {
    const cl = (lead as { clients?: { name?: string; slug?: string } | null }).clients;
    const href = salesScoped
      ? `/sales/leads?lead=${lead.id}`
      : role === "CLIENT_MANAGER"
        ? `/client/leads/pipeline?lead=${lead.id}`
        : `/dashboard/leads?lead=${lead.id}`;
    results.push({
      type: "lead",
      id: lead.id as string,
      title: (lead.name as string | null)?.trim() || "Unnamed lead",
      subtitle: [lead.phone, cl?.name].filter(Boolean).join(" · "),
      meta: statusLabel(String(lead.status)),
      href,
    });
  }

  if (role === "SUPER_ADMIN") {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, slug, industry")
      .eq("is_archived", false)
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
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

  if (role === "SUPER_ADMIN" || role === "CLIENT_MANAGER") {
    let usersQ = supabase
      .from("users")
      .select("id, name, email, role, client_id, clients(name)")
      .eq("is_active", true)
      .in("role", ["SALESPERSON", "CLIENT_MANAGER"])
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(6);
    if (role === "CLIENT_MANAGER" && clientId) {
      usersQ = usersQ.eq("client_id", clientId);
    }
    const { data: users } = await usersQ;
    for (const user of users ?? []) {
      const u = user as { id: string; name: string; email: string; role: string; client_id: string | null; clients?: { name?: string } | null };
      const clientName = u.clients?.name;
      const href =
        role === "SUPER_ADMIN" && u.client_id
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
