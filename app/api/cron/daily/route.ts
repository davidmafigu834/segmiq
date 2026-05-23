import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { executeFollowUpReminders } from "@/lib/follow-up-reminders";
import { checkUncontactedLeads } from "@/lib/notifications";
import { scoreAllLeads } from "@/lib/lead-scoring";
import { sendDailySalespersonCoaching } from "@/lib/ai/daily-coaching";
import { runOnboardingCronJobs } from "@/lib/ai/salesperson-onboarding";

/**
 * Single daily job for Vercel Hobby (free): cron schedules must run at most once per day.
 * Runs uncontacted checks then follow-up reminders. Set `CRON_SECRET` on Vercel so invocations are authenticated.
 */
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];
  let uncontacted: { flagged: number } | undefined;
  let followUp: Awaited<ReturnType<typeof executeFollowUpReminders>> | undefined;

  try {
    await scoreAllLeads();
    console.log("[cron daily] Lead scoring complete");
  } catch (e) {
    console.error("[cron daily] scoreAllLeads", e);
    errors.push(`scoring: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    await sendDailySalespersonCoaching();
    console.log("[cron daily] Daily coaching sent");
  } catch (e) {
    console.error("[cron daily] sendDailySalespersonCoaching", e);
    errors.push(`coaching: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    await runOnboardingCronJobs();
    console.log("[cron daily] Onboarding coaching sent");
  } catch (e) {
    console.error("[cron daily] runOnboardingCronJobs", e);
    errors.push(`onboarding: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    uncontacted = await checkUncontactedLeads();
  } catch (e) {
    console.error("[cron daily] checkUncontactedLeads", e);
    errors.push(`uncontacted: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    followUp = await executeFollowUpReminders();
  } catch (e) {
    console.error("[cron daily] executeFollowUpReminders", e);
    errors.push(`followUp: ${e instanceof Error ? e.message : String(e)}`);
  }

  const ok = errors.length === 0;
  const body: Record<string, unknown> = { ok, uncontacted, followUp };
  if (errors.length > 0) body.errors = errors;
  return NextResponse.json(body, { status: ok ? 200 : 500 });
}
