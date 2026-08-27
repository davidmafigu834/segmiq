import { NextResponse } from "next/server";
import { requireLearningAccess } from "@/lib/agent/learning/access";
import { getLearningSettings } from "@/lib/agent/learning/settings";
import { listCandidates, listKnowledge, sourceStats, summaryCounts } from "@/lib/agent/learning/store";
import { isLearningGloballyEnabled } from "@/lib/agent/learning/policy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireLearningAccess(req, "agent.learning.view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? "discoveries";
  const settings = await getLearningSettings(access.clientId);
  const counts = await summaryCounts(access.clientId);
  const sources = await sourceStats(access.clientId);
  const knowledge = await listKnowledge(access.clientId, "ACTIVE");
  if (tab === "approved") {
    return NextResponse.json({
      settings,
      globallyEnabled: isLearningGloballyEnabled(),
      counts,
      sources,
      knowledge,
      candidates: [],
    });
  }
  const mapped =
    tab === "conflicts" ? "conflicts" : tab === "rejected" ? "rejected" : tab === "sources" ? "discoveries" : "discoveries";
  const candidates = tab === "sources" ? [] : await listCandidates(access.clientId, mapped);
  return NextResponse.json({
    settings,
    globallyEnabled: isLearningGloballyEnabled(),
    counts,
    sources,
    candidates,
    knowledge,
  });
}
