import { NextResponse } from "next/server";
import { executeFollowUpReminders } from "@/lib/follow-up-reminders";
import { demoCronSkip } from "@/lib/demo/cron";

/** Dev-only manual trigger (no CRON_SECRET). Not available in production. */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  const demoSkip = demoCronSkip();
  if (demoSkip) return demoSkip;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  try {
    const r = await executeFollowUpReminders();
    return NextResponse.json(r);
  } catch (e) {
    console.error("[cron follow-up-reminders test]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
