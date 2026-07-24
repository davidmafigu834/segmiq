import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { executeFollowUpReminders } from "@/lib/follow-up-reminders";

/**
 * Timed callback follow-up WhatsApp reminders only.
 * Schedule every minute so `callback_at` is caught near the scheduled time.
 * Day-before / day-of (date) batches run on `/api/cron/daily`.
 * Uncontacted SLA alerts run on `/api/cron/daily` (not here).
 */
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const followUpCallbacks = await executeFollowUpReminders({ callbackOnly: true });
    return NextResponse.json({ ok: true, followUpCallbacks });
  } catch (e) {
    console.error("[cron check-followups] executeFollowUpReminders", e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
