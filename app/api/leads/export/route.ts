import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLeadsForExport, parseLeadFilters, type LeadListRow } from "@/lib/leads/all-leads";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

function csvEscape(v: string): string {
  if (v.includes('"') || v.includes(",") || v.includes("\n")) {
    return `"${v.replaceAll('"', '""')}"`;
  }
  return v;
}

export async function GET(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const u = new URL(req.url);
  const sp = Object.fromEntries(u.searchParams.entries());
  const filters = parseLeadFilters(sp);

  const idsOnly = sp.ids?.trim();
  const supabase = createAdminClient();

  let rows: LeadListRow[];

  if (idsOnly) {
    const idList = idsOnly.split(",").map((s) => s.trim()).filter(Boolean);
    if (!idList.length) {
      return NextResponse.json({ error: "No ids" }, { status: 400 });
    }
    const { data: leads } = await supabase
      .from("leads")
      .select(
        "id, name, phone, email, budget, project_type, source, status, deal_value, created_at, updated_at, follow_up_date, assigned_to_id, client_id, form_data, magic_token, clients!leads_client_id_fkey ( id, name, slug, logo_url, response_time_limit_hours )"
      )
      .in("id", idList)
      .eq("is_archived", false);
    const assigneeIds = Array.from(
      new Set((leads ?? []).map((r) => r.assigned_to_id).filter(Boolean))
    ) as string[];
    let assigneeMap: Record<string, { name: string }> = {};
    if (assigneeIds.length) {
      const { data: users } = await supabase.from("users").select("id, name").in("id", assigneeIds);
      assigneeMap = Object.fromEntries((users ?? []).map((u) => [u.id as string, { name: u.name as string }]));
    }
    rows = (leads ?? []).map((r) => {
      const aid = r.assigned_to_id as string | null;
      return {
        ...(r as object),
        assigned_to: aid
          ? {
              id: aid,
              name: assigneeMap[aid]?.name ?? "—",
              avatar_url: null,
            }
          : null,
      } as LeadListRow;
    });
  } else {
    rows = await fetchLeadsForExport(filters, 10_000);
  }

  const leadIds = rows.map((r) => r.id);
  const lastCall: Record<string, { outcome: string; created_at: string }> = {};
  if (leadIds.length) {
    const { data: logs } = await supabase
      .from("call_logs")
      .select("lead_id, outcome, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });
    for (const log of logs ?? []) {
      const lid = log.lead_id as string;
      if (!lastCall[lid]) {
        lastCall[lid] = { outcome: String(log.outcome), created_at: log.created_at as string };
      }
    }
  }

  const header = [
    "Created date",
    "Client",
    "Lead name",
    "Phone",
    "Email",
    "Source",
    "Status",
    "Budget",
    "Project type",
    "Assigned salesperson",
    "Deal value",
    "Last call outcome",
    "Last call date",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    const lc = lastCall[r.id];
    lines.push(
      [
        csvEscape(format(new Date(r.created_at), "yyyy-MM-dd HH:mm")),
        csvEscape(r.clients?.name ?? "—"),
        csvEscape(r.name ?? "—"),
        csvEscape(r.phone ?? "—"),
        csvEscape(r.email ?? "—"),
        csvEscape(r.source),
        csvEscape(r.status),
        csvEscape(r.budget ?? "—"),
        csvEscape(r.project_type ?? "—"),
        csvEscape(r.assigned_to?.name ?? "—"),
        csvEscape(r.deal_value != null ? String(r.deal_value) : "—"),
        csvEscape(lc?.outcome ?? "—"),
        csvEscape(lc ? format(new Date(lc.created_at), "yyyy-MM-dd HH:mm") : "—"),
      ].join(",")
    );
  }

  const body = lines.join("\n");
  const filename = `leadstaq-leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
