import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCompanyReportData } from "@/lib/sales/get-company-reports-data";
import {
  defaultCompanyReportRange,
  parseIsoDate,
  suggestGranularity,
  type ReportGranularity,
} from "@/lib/sales/company-reports/range";
import type { CompanyReportTab } from "@/lib/sales/company-reports/types";
import { COMPANY_REPORT_TABS } from "@/lib/sales/company-reports/types";

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
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const resolved = resolveClientId(session, url);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
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
    granParam === "day" || granParam === "week" || granParam === "month"
      ? granParam
      : suggestGranularity(rangeFrom, rangeTo);

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
    return NextResponse.json(report, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e: unknown) {
    console.error("[reports/company]", e);
    const message = e instanceof Error ? e.message : "Report failed";
    const status = message.toLowerCase().includes("forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
