import type { ConversationalFormStep } from "@/components/profile/ConversationalForm";

export type BudgetQualifierHints = {
  budgetMin?: number | null;
  budgetMax?: number | null;
};

/**
 * Labels use a single numeric anchor so lead-scoring's existing parser
 * (first digit run in the string) maps to the intended tier.
 */
export const DEFAULT_BUDGET_RANGE_OPTIONS = [
  "Under $5,000",
  "$10,000",
  "$20,000",
  "$50,000",
  "Over $50,000",
] as const;

function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/**
 * Budget range chips for the optional form question.
 * Scales bands when campaign_qualifiers min/max are set.
 */
export function getBudgetRangeOptions(hints?: BudgetQualifierHints): string[] {
  const min = hints?.budgetMin ?? null;
  const max = hints?.budgetMax ?? null;

  if (min == null && max == null) {
    return [...DEFAULT_BUDGET_RANGE_OPTIONS];
  }

  const floor = min != null && min > 0 ? min : 5000;
  const ceiling =
    max != null && max > floor ? max : Math.max(floor * 4, 50000);

  const mid = Math.round((floor + ceiling) / 2);
  const upperMid = Math.round(ceiling * 0.75);

  return [
    `Under ${formatUsd(floor)}`,
    formatUsd(mid),
    formatUsd(upperMid),
    formatUsd(ceiling),
    `Over ${formatUsd(ceiling)}`,
  ];
}

function stepHasBudgetField(steps: ConversationalFormStep[]): boolean {
  return steps.some((step) =>
    step.fields.some((f) => f.maps_to === "budget")
  );
}

/**
 * Injects one optional budget select when enabled and no existing budget field.
 * Places it immediately before the name/contact field when possible.
 */
export function injectOptionalBudgetQuestion(
  steps: ConversationalFormStep[],
  options: string[]
): ConversationalFormStep[] {
  if (stepHasBudgetField(steps)) return steps;

  const budgetField = {
    id: "optional-budget-question",
    field_type: "select" as const,
    label: "Rough budget for this project?",
    is_required: false,
    maps_to: "budget",
    options: [...options],
  };

  const cloned: ConversationalFormStep[] = steps.map((step) => ({
    ...step,
    fields: [...step.fields],
  }));

  for (const step of cloned) {
    const nameIdx = step.fields.findIndex((f) => f.maps_to === "name");
    if (nameIdx >= 0) {
      step.fields.splice(nameIdx, 0, budgetField);
      return cloned;
    }
  }

  const contactIdx = cloned.findIndex((s) =>
    s.fields.some((f) => f.maps_to === "phone" || f.maps_to === "email")
  );
  if (contactIdx >= 0) {
    cloned[contactIdx]!.fields.unshift(budgetField);
    return cloned;
  }

  cloned.splice(Math.max(0, cloned.length - 1), 0, {
    id: "budget-step",
    title: "Budget",
    fields: [budgetField],
  });

  return cloned;
}
