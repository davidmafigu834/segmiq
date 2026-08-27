import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const { data: recentLeads } = await supabase
    .from("leads")
    .select("id, name, status, created_at, client_id, clients!leads_client_id_fkey ( name )")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: won } = await supabase
    .from("leads")
    .select("id, name, updated_at, clients!leads_client_id_fkey ( name )")
    .eq("status", "WON")
    .order("updated_at", { ascending: false })
    .limit(5);

  const events: { id: string; label: string; at: string }[] = [];
  for (const l of recentLeads ?? []) {
    const cn = (l as { clients?: { name?: string } | null }).clients?.name ?? "";
    events.push({
      id: `nl-${l.id}`,
      label: `New lead: ${l.name ?? "—"} (${cn})`,
      at: l.created_at as string,
    });
  }
  for (const l of won ?? []) {
    events.push({
      id: `won-${l.id}`,
      label: `Deal won: ${l.name ?? "—"}`,
      at: l.updated_at as string,
    });
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return NextResponse.json({ events: events.slice(0, 10) });
}
