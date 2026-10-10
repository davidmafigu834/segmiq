import { NextResponse } from "next/server";
import { canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAnalysis, listWorkItems, toPublicItem } from "@/lib/sales-copilot/store";
import { runDueCopilotJobs } from "@/lib/sales-copilot/jobs";

export const dynamic = "force-dynamic";

function visible(item: ReturnType<typeof toPublicItem>, now: number) {
  if (item.fulfilmentStatus !== "open") return false;
  if (item.reviewStatus === "dismissed" || item.reviewStatus === "stale") return false;
  if (item.snoozeUntil && new Date(item.snoozeUntil).getTime() > now) return false;
  return true;
}

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const access = await canReadLead(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }
  try {
    const supabase = createAdminClient();
    const { data: lead } = await supabase
      .from("leads")
      .select("client_id")
      .eq("id", params.leadId)
      .maybeSingle();
    if (!lead?.client_id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [analysis, items] = await Promise.all([
      loadAnalysis(params.leadId),
      listWorkItems(params.leadId, lead.client_id as string),
    ]);
    void runDueCopilotJobs(2).catch(() => undefined);
    const now = Date.now();
    const publicItems = items.map(toPublicItem).filter((item) => visible(item, now));
    publicItems.sort((a, b) => {
      const rank = (queue: string, execution: string) =>
        execution === "failed" ? 0 : queue === "needs_review" ? 1 : queue === "todo" ? 2 : 3;
      return rank(a.queue, a.executionStatus) - rank(b.queue, b.executionStatus);
    });
    return NextResponse.json({
      feature: "Sales Copilot",
      analysis: {
        status: analysis?.status ?? "pending",
        summary: analysis?.summary ?? null,
        updatedAt: analysis?.updated_at ?? null,
        error: analysis?.error ?? null,
      },
      items: publicItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/sales_copilot|does not exist|relation/i.test(message)) {
      return NextResponse.json({
        feature: "Sales Copilot",
        analysis: {
          status: "failed",
          summary: "Sales Copilot is not available until the latest database migration is applied. Chat and manual tasks still work.",
          updatedAt: null,
          error: "schema_missing",
        },
        items: [],
      });
    }
    console.error("[sales-copilot] conversation", err);
    return NextResponse.json({ error: "Failed to load Sales Copilot" }, { status: 500 });
  }
}
