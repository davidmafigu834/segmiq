import { buildChecks } from "@/lib/real-estate/due-diligence/rules";
import { summarise } from "@/lib/real-estate/due-diligence/report";
import type { Evaluation, EvaluationInput } from "@/lib/real-estate/due-diligence/types";

/** Pure entry point. Document reading and database writes stay outside this function. */
export function evaluateDueDiligence(input: EvaluationInput): Evaluation {
  const checks = buildChecks(input);
  return { checks, ...summarise(input, checks) };
}
