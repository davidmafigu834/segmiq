import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { executeFollowUpReminders } from "@/lib/follow-up-reminders";

/**
 * Timed T-30 follow-up WhatsApp reminders (rep + lead), once each.
 * Morning digests run on `/api/cron/daily` at 06:00.
 */
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const followUpCallbacks = await executeFollowUpReminders({ t30Only: true });
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
