import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { executeFollowUpReminders } from "@/lib/follow-up-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Timed T-30 follow-up WhatsApp reminders (rep + lead), once each.
 * Morning digests run on `/api/cron/daily` at 06:00.
 * Also resumes agent threads left in AI_HANDLING after a timed-out LLM run.
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
    const { runProactiveWorker } = await import("@/lib/agent/proactive");
    const { recoverStaleAgentConversations } = await import("@/lib/agent/stale-resume");
    const { runLearningWorker } = await import("@/lib/agent/learning/worker");
    const proactive = await runProactiveWorker();
    const staleAgent = await recoverStaleAgentConversations();
    const learning = await runLearningWorker();
    return NextResponse.json({ ok: true, followUpCallbacks, proactive, staleAgent, learning });
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
