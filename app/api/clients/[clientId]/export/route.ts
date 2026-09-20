import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";
import {
  recordSupportAccessEvent,
  requireClientDataAccess,
} from "@/lib/security/support-access";

export const dynamic = "force-dynamic";

function csvEscape(s: string | number | null | undefined): string {
  const t = s == null ? "" : String(s);
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in g) return g.error;

  // Mass export is stricter than reading one record: it needs its own platform
  // permission on top of an active LEADS Support Access grant.
  if (
    !hasPermission(
      {
        userId: g.session.userId,
        role: g.session.role,
        clientId: g.session.clientId ?? null,
        isImpersonating: false,
      },
      P.CLIENT_DATA_EXPORT
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gate = await requireClientDataAccess({
    req,
    clientId: params.clientId,
    scope: "LEADS",
    resourceType: "lead_export",
  });
  if (gate.error) return gate.error;

  const supabase = createAdminClient();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, phone, email, status, budget, source, created_at, updated_at")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = ["id", "name", "phone", "email", "status", "budget", "source", "created_at", "updated_at"];
  const lines = [headers.join(",")];
  for (const row of leads ?? []) {
    lines.push(
      [
        csvEscape(row.id as string),
        csvEscape(row.name as string | null),
        csvEscape(row.phone as string | null),
        csvEscape(row.email as string | null),
        csvEscape(row.status as string),
        csvEscape(row.budget as string | null),
        csvEscape(row.source as string),
        csvEscape(row.created_at as string),
        csvEscape(row.updated_at as string),
      ].join(",")
    );
  }

  void recordSupportAccessEvent({
    eventType: "CLIENT_DATA_EXPORTED",
    clientId: params.clientId,
    grantId: gate.context.grant?.id ?? null,
    actorUserId: g.session.userId,
    actorRole: g.session.role,
    scope: "LEADS",
    resourceType: "lead_export",
    metadata: { rowCount: leads?.length ?? 0 },
  });

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${params.clientId.slice(0, 8)}.csv"`,
    },
  });
}
