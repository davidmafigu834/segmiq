/**
 * Budget signal verification — form answer → score factor; optional injection gate.
 * Run: npx tsx scripts/verify-budget-signal.ts
 */
import assert from "node:assert/strict";
import {
  getBudgetRangeOptions,
  injectOptionalBudgetQuestion,
} from "../lib/budget-question-presets";
import { computeBudgetScoreComponent } from "../lib/lead-scoring";
import type { ConversationalFormStep } from "../components/profile/ConversationalForm";

const defaultSteps: ConversationalFormStep[] = [
  {
    id: "default",
    title: "Contact",
    fields: [
      {
        id: "name",
        field_type: "text",
        label: "Name?",
        is_required: true,
        maps_to: "name",
      },
      {
        id: "phone",
        field_type: "phone",
        label: "Phone?",
        is_required: true,
        maps_to: "phone",
      },
    ],
  },
];

// form_data.budget → Budget factor (no scoring formula change)
assert.equal(
  computeBudgetScoreComponent({ formData: { budget: "$10,000" } }),
  6,
  "$10k answer should score 6"
);
assert.equal(
  computeBudgetScoreComponent({ formData: { budget: "Under $5,000" } }),
  4,
  "Under $5k should parse floor as 5000 → score 4"
);
assert.equal(
  computeBudgetScoreComponent({ formData: { budget_range: "Over $50,000" } }),
  10,
  "budget_range key is also read"
);
assert.equal(computeBudgetScoreComponent({ formData: {} }), 0, "no budget → 0");

// Clients without toggle: profile page does not call inject — steps stay as-is
assert.equal(
  defaultSteps.some((s) => s.fields.some((f) => f.maps_to === "budget")),
  false,
  "without toggle/inject, no budget field"
);

// Toggle ON path: budget injected before name, skippable
const injected = injectOptionalBudgetQuestion(
  defaultSteps,
  getBudgetRangeOptions()
);
assert.equal(injected[0]!.fields[0]!.maps_to, "budget");
assert.equal(injected[0]!.fields[0]!.is_required, false);
assert.equal(injected[0]!.fields[1]!.maps_to, "name");

// No duplicate if form_steps already have budget
const withBudget: ConversationalFormStep[] = [
  {
    id: "s1",
    title: "Project",
    fields: [
      {
        id: "b1",
        field_type: "select",
        label: "Budget",
        is_required: false,
        maps_to: "budget",
        options: ["$5,000"],
      },
    ],
  },
];
assert.equal(
  injectOptionalBudgetQuestion(withBudget, getBudgetRangeOptions()),
  withBudget,
  "existing budget field prevents duplicate inject"
);

// Qualifier-scaled options
const scaled = getBudgetRangeOptions({ budgetMin: 10000, budgetMax: 80000 });
assert.ok(scaled[0]!.includes("10,000"), "qualifiers scale range floor");

console.log("verify-budget-signal: all assertions passed");
