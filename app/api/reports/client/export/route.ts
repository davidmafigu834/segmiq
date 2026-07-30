import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgencyReportFilters } from "@/lib/agency-report";
import { buildAgencyExportCsv } from "@/lib/agency-report-export";
import type { LeadSource, LeadStatus } from "@/types";

export const dynamic = "force-dynamic";

function resolveTargetClientId(session: Session, url: URL): { clientId: string } | { error: string; status: number } {
  const q = url.searchParams.get("clientId");
  if (session.role === "SUPER_ADMIN") {
    if (!q) {
      return { error: "clientId query param required for agency admin", status: 400 };
    }
    return { clientId: q };
  }
  if (session.role === "CLIENT_MANAGER") {
    if (!session.clientId) {
      return { error: "Forbidden", status: 403 };
    }
    if (q && q !== session.clientId) {
      return { error: "Forbidden", status: 403 };
    }
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
  const resolved = resolveTargetClientId(session, url);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "from and to ISO dates required" }, { status: 400 });
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const STATUSES: LeadStatus[] = [
    "NEW",
    "CONTACTED",
    "NEGOTIATING",
    "PROPOSAL_SENT",
    "WON",
    "LOST",
    "NOT_QUALIFIED",
  ];
  const statusesParam = url.searchParams.get("statuses");
  const statuses =
    statusesParam && statusesParam.length > 0
      ? (statusesParam.split(",").filter((s) => STATUSES.includes(s as LeadStatus)) as LeadStatus[])
      : undefined;

  const sourceParam = url.searchParams.get("source");
  const sources =
    sourceParam &&
    sourceParam !== "all" &&
    (sourceParam === "FACEBOOK" || sourceParam === "LANDING_PAGE" || sourceParam === "MANUAL")
      ? ([sourceParam] as LeadSource[])
      : undefined;

  const assignedParam = url.searchParams.get("assignedToId");
  const assignedToIds =
    assignedParam && assignedParam !== "all" && assignedParam.length > 0 ? [assignedParam] : undefined;

  const filters: AgencyReportFilters = {
    clientIds: [resolved.clientId],
    sources,
    statuses: statuses?.length ? statuses : undefined,
    assignedToIds,
  };

  const supabase = createAdminClient();
  const { data: cl } = await supabase.from("clients").select("slug").eq("id", resolved.clientId).maybeSingle();
  const slugRaw = (cl?.slug as string) || "client";
  const slug = slugRaw.replace(/[^\w-]+/g, "-").slice(0, 48) || "client";
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `${slug}-leads-${datePart}.csv`;

  try {
    const { csv } = await buildAgencyExportCsv(from.toISOString(), to.toISOString(), filters, filename);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e: unknown) {
    console.error("[reports/client/export]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}
