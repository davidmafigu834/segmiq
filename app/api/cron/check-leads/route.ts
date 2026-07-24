import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { executeFollowUpReminders } from "@/lib/follow-up-reminders";

/**
 * Backwards-compatible alias for timed callback follow-up reminders.
 * Prefer `/api/cron/check-followups` (every minute). Uncontacted SLA alerts
 * run once daily on `/api/cron/daily` only — not here.
 */
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];
  let followUpCallbacks: Awaited<ReturnType<typeof executeFollowUpReminders>> | undefined;

  try {
    followUpCallbacks = await executeFollowUpReminders({ callbackOnly: true });
  } catch (e) {
    console.error("[cron check-leads] executeFollowUpReminders", e);
    errors.push(`followUpCallbacks: ${e instanceof Error ? e.message : String(e)}`);
  }

  const ok = errors.length === 0;
  const body: Record<string, unknown> = {
    ok,
    followUpCallbacks,
    deprecated: "Prefer /api/cron/check-followups for timed follow-up reminders",
  };
  if (errors.length > 0) body.errors = errors;
  return NextResponse.json(body, { status: ok ? 200 : 500 });
}
