import { LeadScoreBadge } from "@/components/sales/ui";

type Props = {
  score: number | null | undefined;
};

/** @deprecated Use LeadScoreBadge from @/components/sales/ui */
export function ScoreBadge({ score }: Props) {
  if (score == null || !Number.isFinite(score)) return null;
  return <LeadScoreBadge score={score} showScore />;
}
