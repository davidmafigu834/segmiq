import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { listJobs, countJobsToday, getProactiveSettings } from "@/lib/agent/proactive";
import { REASON_CODE_LABELS, type ProactiveJobState } from "@/lib/agent/proactive/types";

export const dynamic = "force-dynamic";

async function resolveClient(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth) return { ok: false as const, status: 401, error: "Unauthorized" };
  const url = new URL(req.url);
  const requested = url.searchParams.get("clientId");
  if (auth.role === "SUPER_ADMIN") {
    const clientId = requested ?? auth.clientId;
    if (!clientId) return { ok: false as const, status: 400, error: "clientId required" };
    return { ok: true as const, clientId, role: auth.role, userId: auth.userId };
  }
  if (!auth.clientId) return { ok: false as const, status: 403, error: "Forbidden" };
  if (requested && requested !== auth.clientId) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, clientId: auth.clientId, role: auth.role, userId: auth.userId };
}

export async function GET(req: Request) {
  const access = await resolveClient(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "upcoming";
  const leadId = url.searchParams.get("leadId") ?? undefined;
  const settings = await getProactiveSettings(access.clientId);

  if (view === "counts") {
    const counts = await countJobsToday(access.clientId);
    return NextResponse.json({ counts, settings: { enabled: settings.enabled, shadowMode: settings.shadowMode } });
  }

  const upcomingStatuses: ProactiveJobState[] = ["SCHEDULED", "WAITING_FOR_CHANNEL", "WAITING_FOR_HUMAN"];
  const historyStatuses: ProactiveJobState[] = [
    "COMPLETED",
    "SKIPPED",
    "FAILED",
    "EXPIRED",
    "CANCELLED",
  ];
  const statuses = view === "history" ? historyStatuses : upcomingStatuses;
  const jobs = await listJobs({
    clientId: access.clientId,
    leadId,
    statuses,
    limit: view === "history" ? 80 : 60,
  });

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      ...j,
      reasonLabel: j.reasonCode ? REASON_CODE_LABELS[j.reasonCode as keyof typeof REASON_CODE_LABELS] ?? j.reasonCode : null,
    })),
    settings: {
      enabled: settings.enabled,
      shadowMode: settings.shadowMode,
      customerMessaging: settings.customerMessaging,
    },
  });
}
