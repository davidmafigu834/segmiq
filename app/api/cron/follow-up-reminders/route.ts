import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { demoCronSkip } from "@/lib/demo/cron";
import { executeFollowUpReminders } from "@/lib/follow-up-reminders";

export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const demoSkip = demoCronSkip();
  if (demoSkip) return demoSkip;
  try {
    const r = await executeFollowUpReminders();
    return NextResponse.json(r);
  } catch (e) {
    console.error("[cron follow-up-reminders]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
