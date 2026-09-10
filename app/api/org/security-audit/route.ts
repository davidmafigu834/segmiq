import { NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/auth/rbac/resolve";
import { P } from "@/lib/auth/rbac/permissions";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { requireElevatedSession } from "@/lib/auth/step-up";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/auth/user-sessions";

export const dynamic = "force-dynamic";

/** Admin / org oversight events — never include employee workstation IPs in the response. */
const ORG_AUDIT_EVENTS = [
  "IMPERSONATION_STARTED",
  "IMPERSONATION_START",
  "IMPERSONATION_STOP",
  "IMPERSONATION_STOPPED",
  "MFA_ADMIN_RESET",
  "USER_DISABLED",
  "ROLE_CHANGED",
  "TENANT_CHANGED",
  "ORG_SECURITY_POLICY_UPDATED",
  "WEBSITE_API_KEY_ROTATED",
  "WEBSITE_API_KEY_REVOKED",
  "DATA_EXPORT",
  "SECURITY_AUDIT_EXPORT",
  "INTEGRATION_CONNECTED",
  "INTEGRATION_DISCONNECTED",
  "INTEGRATION_AUTH_FAILED",
  "WHATSAPP_CONNECTION_REMOVED",
  "AGENT_CONFIRMATION_APPROVED",
  "AGENT_CONFIRMATION_REJECTED",
] as const;

function actor(session: {
  userId: string;
  role: string;
  clientId: string | null;
  alsoSells?: boolean;
  isImpersonating?: boolean;
}) {
  return {
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
    alsoSells: session.alsoSells,
    isImpersonating: Boolean(session.isImpersonating),
  };
}

function summarizeOrgEvent(type: string, meta: Record<string, unknown> | null): string {
  switch (type) {
    case "IMPERSONATION_STARTED":
    case "IMPERSONATION_START":
      return "Support impersonation started";
    case "IMPERSONATION_STOP":
    case "IMPERSONATION_STOPPED":
      return "Support impersonation ended";
    case "MFA_ADMIN_RESET":
      return "Admin reset two-step verification";
    case "USER_DISABLED":
      return "User disabled";
    case "ROLE_CHANGED":
      return "Role changed";
    case "ORG_SECURITY_POLICY_UPDATED":
      return "Organisation security policy updated";
    case "WEBSITE_API_KEY_ROTATED":
      return "Website API key rotated";
    case "WEBSITE_API_KEY_REVOKED":
      return "Website API key revoked";
    case "DATA_EXPORT":
      return "Data export";
    case "SECURITY_AUDIT_EXPORT":
      return "Security audit exported";
    case "INTEGRATION_CONNECTED":
      return "Integration connected";
    case "INTEGRATION_DISCONNECTED":
      return "Integration disconnected";
    default:
      return type;
  }
}

/** GET org audit log (managers). Omits IP addresses. */
export async function GET(req: Request) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;

  if (!hasPermission(actor(g.session), P.SECURITY_AUDIT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = g.session.clientId;
  if (!clientId && g.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No organisation context" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "30") || 30));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);
  const format = url.searchParams.get("format");

  if (format === "csv") {
    const origin = assertBrowserOrigin(req);
    if (!origin.ok) {
      return NextResponse.json({ error: origin.error }, { status: origin.status });
    }
    const elev = await requireElevatedSession({
      sessionId: g.session.sessionId,
      userId: g.session.userId,
    });
    if (!elev.ok) {
      return NextResponse.json({ error: elev.error }, { status: elev.status });
    }
  }

  const supabase = createAdminClient();
  let q = supabase
    .from("security_events")
    .select("id, event_type, created_at, metadata, user_id")
    .in("event_type", [...ORG_AUDIT_EVENTS])
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (clientId) {
    q = q.eq("client_id", clientId);
  } else if (g.session.role === "SUPER_ADMIN") {
    const filterClient = url.searchParams.get("clientId");
    if (filterClient) q = q.eq("client_id", filterClient);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
  }

  const events = (data ?? []).map((row) => {
    const meta = (row.metadata as Record<string, unknown> | null) ?? null;
    // Strip any IP-like fields from metadata before returning
    const safeMeta: Record<string, unknown> = {};
    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        if (/ip/i.test(k)) continue;
        safeMeta[k] = v;
      }
    }
    return {
      id: row.id,
      type: row.event_type,
      createdAt: row.created_at,
      userId: row.user_id,
      summary: summarizeOrgEvent(row.event_type as string, meta),
      metadata: safeMeta,
    };
  });

  if (format === "csv") {
    void recordSecurityEvent({
      eventType: "SECURITY_AUDIT_EXPORT",
      userId: g.session.userId,
      clientId: clientId ?? null,
      sessionId: g.session.sessionId,
      ip: clientIpFromRequest(req),
      userAgent: userAgentFromRequest(req),
      metadata: { count: events.length },
    });
    const header = "id,type,createdAt,userId,summary\n";
    const lines = events.map((e) =>
      [e.id, e.type, e.createdAt, e.userId ?? "", JSON.stringify(e.summary)].join(",")
    );
    return new NextResponse(header + lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="org-security-audit.csv"`,
      },
    });
  }

  return NextResponse.json({ events, limit, offset });
}
