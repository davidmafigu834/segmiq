import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { executeFollowUpReminders } from "@/lib/follow-up-reminders";
import { checkUncontactedLeads } from "@/lib/notifications";

/** Uncontacted-lead checks plus timed callback follow-up reminders. Schedule every ~30m with `Authorization: Bearer <CRON_SECRET>`. Due/prep follow-ups run on `/api/cron/daily` and `/api/cron/follow-up-reminders`. */
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];
  let uncontacted: Awaited<ReturnType<typeof checkUncontactedLeads>> | undefined;
  let followUpCallbacks: Awaited<ReturnType<typeof executeFollowUpReminders>> | undefined;

  try {
    uncontacted = await checkUncontactedLeads();
  } catch (e) {
    console.error("[cron check-leads] checkUncontactedLeads", e);
    errors.push(`uncontacted: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    followUpCallbacks = await executeFollowUpReminders({ callbackOnly: true });
  } catch (e) {
    console.error("[cron check-leads] executeFollowUpReminders", e);
    errors.push(`followUpCallbacks: ${e instanceof Error ? e.message : String(e)}`);
  }

  const ok = errors.length === 0;
  const body: Record<string, unknown> = { ok, uncontacted, followUpCallbacks };
  if (errors.length > 0) body.errors = errors;
  return NextResponse.json(body, { status: ok ? 200 : 500 });
}
