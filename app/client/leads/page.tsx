import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { addMonths, startOfMonth } from "date-fns";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ClientLeadsTable } from "@/components/client-leads/ClientLeadsTable";
import type { ClientLeadListRow } from "@/components/client-leads/client-leads-types";

export default async function ClientLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER") redirect("/login");

  const supabase = createAdminClient();
  const clientId = session.clientId;

  const PAGE_LIMIT = 50;

  const [{ data: leadsRaw, count: leadsCount }, { data: salespeople }, { data: clientRow }] = await Promise.all([
    supabase
      .from("leads")
      .select("*, assigned_to:users!assigned_to_id ( id, name, avatar_url )", { count: "exact" })
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .range(0, PAGE_LIMIT - 1),
    supabase.from("users").select("id, name").eq("client_id", clientId).eq("role", "SALESPERSON").eq("is_active", true),
    supabase.from("clients").select("name, slug").eq("id", clientId).maybeSingle(),
  ]);

  const rows = leadsRaw ?? [];
  const totalCount = leadsCount ?? 0;
  const hasMore = rows.length >= PAGE_LIMIT && totalCount > PAGE_LIMIT;

  const ids = rows.map((l) => l.id as string);
  const lastBy = new Map<string, string>();
  if (ids.length) {
    const { data: logs } = await supabase
      .from("call_logs")
      .select("lead_id, created_at")
      .in("lead_id", ids)
      .order("created_at", { ascending: false });
    for (const log of logs ?? []) {
      const lid = log.lead_id as string;
      if (!lastBy.has(lid)) lastBy.set(lid, log.created_at as string);
    }
  }

  const initialLeads: ClientLeadListRow[] = rows.map((row) => ({
    ...(row as ClientLeadListRow),
    last_call_at: lastBy.get(row.id as string) ?? null,
  }));

  const m0 = startOfMonth(new Date()).toISOString();
  const m1 = addMonths(startOfMonth(new Date()), 1).toISOString();
  const totalThisMonth = initialLeads.filter((l) => l.created_at >= m0 && l.created_at < m1).length;

  const clientName = (clientRow?.name as string) ?? "Your company";

  return (
    <ClientManagerLayout breadcrumbPage="LEADS" pageTitle="Leads" hideShellHeader>
      <Suspense fallback={<div className="shimmer h-64 rounded-lg" />}>
        <div className="px-0">
          <ClientLeadsTable
            clientId={clientId}
            clientName={clientName}
            initialLeads={initialLeads}
            salespeople={(salespeople ?? []) as { id: string; name: string }[]}
            totalThisMonth={totalThisMonth}
            initialHasMore={hasMore}
            totalCount={totalCount}
          />
        </div>
      </Suspense>
    </ClientManagerLayout>
  );
}
