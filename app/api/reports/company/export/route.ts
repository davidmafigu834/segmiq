import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCompanyReportData } from "@/lib/sales/get-company-reports-data";
import {
  buildCompanyReportCsv,
  companyReportExportFilename,
} from "@/lib/sales/company-reports/export";
import {
  defaultCompanyReportRange,
  parseIsoDate,
  suggestGranularity,
  type ReportGranularity,
} from "@/lib/sales/company-reports/range";
import { COMPANY_REPORT_TABS, type CompanyReportTab } from "@/lib/sales/company-reports/types";
import { hasPermission, P } from "@/lib/auth/rbac";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { requireElevatedSession } from "@/lib/auth/step-up";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { parseOrgSecurityPolicy } from "@/lib/auth/org-security-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/auth/user-sessions";

export const dynamic = "force-dynamic";

const TABS = new Set(COMPANY_REPORT_TABS.map((t) => t.id));

function resolveClientId(session: Session, url: URL): { clientId: string } | { error: string; status: number } {
  const q = url.searchParams.get("clientId");
  if (session.role === "SUPER_ADMIN") {
    if (!q && !session.clientId) return { error: "clientId query param required for agency admin", status: 400 };
    return { clientId: q || session.clientId! };
  }
  if (session.role === "CLIENT_MANAGER") {
    if (!session.clientId) return { error: "Forbidden", status: 403 };
    if (q && q !== session.clientId) return { error: "Forbidden", status: 403 };
    return { clientId: session.clientId };
  }
  return { error: "Forbidden", status: 403 };
}

export async function GET(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !hasPermission(
      {
        userId: session.userId,
        role: session.role,
        clientId: session.clientId,
        alsoSells: session.alsoSells,
        isImpersonating: Boolean(session.isImpersonating),
      },
      P.DATA_EXPORT
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const elev = await requireElevatedSession({
    sessionId: session.sessionId,
    userId: session.userId,
  });
  if (!elev.ok) {
    return NextResponse.json({ error: elev.error }, { status: elev.status });
  }

  const url = new URL(req.url);
  const resolved = resolveClientId(session, url);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  // Org policy may disable exports
  const supabase = createAdminClient();
  const { data: clientRow } = await supabase
    .from("clients")
    .select("security_policy")
    .eq("id", resolved.clientId)
    .maybeSingle();
  const policy = parseOrgSecurityPolicy(clientRow?.security_policy);
  if (!policy.allowDataExports && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Data exports disabled by organisation policy" }, { status: 403 });
  }

  const tabParam = (url.searchParams.get("tab") || "overview") as CompanyReportTab;
  const tab = TABS.has(tabParam) ? tabParam : "overview";
  const from = parseIsoDate(url.searchParams.get("from"));
  const to = parseIsoDate(url.searchParams.get("to"));
  const fallback = defaultCompanyReportRange();
  const rangeFrom = from ?? fallback.from;
  const rangeTo = to ?? fallback.to;
  if (rangeFrom >= rangeTo) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  const granParam = url.searchParams.get("granularity");
  const granularity: ReportGranularity | null =
    granParam === "day" || granParam === "week" || granParam === "month" ? granParam : suggestGranularity(rangeFrom, rangeTo);
  const ownerId = url.searchParams.get("ownerId")?.trim() || null;

  try {
    const report = await getCompanyReportData({
      clientId: resolved.clientId,
      actor: {
        userId: session.userId,
        role: session.role,
        clientId: session.clientId,
      },
      tab,
      from: rangeFrom,
      to: rangeTo,
      ownerId,
      granularity,
    });
    const csv = buildCompanyReportCsv(report);
    const filename = companyReportExportFilename(report);
    void recordSecurityEvent({
      eventType: "DATA_EXPORT",
      userId: session.userId,
      clientId: resolved.clientId,
      sessionId: session.sessionId,
      ip: clientIpFromRequest(req),
      userAgent: userAgentFromRequest(req),
      metadata: { kind: "company_report", tab },
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (e: unknown) {
    console.error("[reports/company/export]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}
