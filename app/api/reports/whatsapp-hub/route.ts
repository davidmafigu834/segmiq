import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  computeWhatsAppHubReport,
  type WhatsAppHubPeriod,
} from "@/lib/whatsapp-hub-report";

export const dynamic = "force-dynamic";

function resolveClient(
  session: Session,
  url: URL
): { clientId: string; salespersonId?: string } | { error: string; status: number } {
  const qClient = url.searchParams.get("clientId");

  if (session.role === "SUPER_ADMIN") {
    if (!qClient) return { error: "clientId query param required", status: 400 };
    return { clientId: qClient };
  }

  if (session.role === "CLIENT_MANAGER") {
    if (!session.clientId) return { error: "Forbidden", status: 403 };
    if (qClient && qClient !== session.clientId) return { error: "Forbidden", status: 403 };
    return { clientId: session.clientId };
  }

  if (session.role === "SALESPERSON") {
    if (!session.clientId) return { error: "Forbidden", status: 403 };
    return { clientId: session.clientId, salespersonId: session.userId };
  }

  return { error: "Forbidden", status: 403 };
}

function parsePeriod(v: string | null): WhatsAppHubPeriod {
  return v === "this_month" ? "this_month" : "this_week";
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const resolved = resolveClient(session, url);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  try {
    const report = await computeWhatsAppHubReport({
      clientId: resolved.clientId,
      period: parsePeriod(url.searchParams.get("period")),
      salespersonId: resolved.salespersonId ?? null,
    });
    return NextResponse.json(report, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (e: unknown) {
    console.error("[reports/whatsapp-hub]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "WhatsApp hub report failed" },
      { status: 500 }
    );
  }
}
