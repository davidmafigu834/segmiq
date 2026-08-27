import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAgentAlert } from "@/lib/agent/notifications";
import type { LearningComparisonState, LearningRiskLevel } from "./types";

export async function notifyLearningReview(opts: {
  clientId: string;
  candidateId: string;
  title: string;
  riskLevel: LearningRiskLevel;
  comparisonState: LearningComparisonState;
  isCorrection: boolean;
}): Promise<void> {
  const notable =
    opts.comparisonState === "CONFLICTS" ||
    opts.isCorrection ||
    opts.riskLevel === "VERY_HIGH" ||
    opts.riskLevel === "HIGH";
  if (!notable) return;

  const supabase = createAdminClient();
  const { data: managers } = await supabase
    .from("users")
    .select("id")
    .eq("client_id", opts.clientId)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true);
  const message =
    opts.comparisonState === "CONFLICTS"
      ? `Learning conflict needs review: ${opts.title}`
      : opts.isCorrection
        ? `Agent correction detected: ${opts.title}`
        : `High-confidence learning needs review: ${opts.title}`;
  await Promise.all(
    (managers ?? []).map((m) =>
      notifyAgentAlert({
        userId: m.id as string,
        message,
      })
    )
  );
}
