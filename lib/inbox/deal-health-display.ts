import type { DealAttentionState } from "@/lib/sales/deals/attention";

export type DealHealthLabel = "On track" | "Needs attention" | "At risk";

export function dealHealthFromAttention(
  attention: Pick<DealAttentionState, "atRisk" | "needsAttention"> | null | undefined
): DealHealthLabel {
  if (!attention) return "On track";
  if (attention.atRisk) return "At risk";
  if (attention.needsAttention) return "Needs attention";
  return "On track";
}
