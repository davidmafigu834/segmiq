import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import {
  MANUAL_LEAD_STAGES,
  scoreFromManualPriority,
} from "../lib/customer-hub/manual-lead-intake";

const prioritySchema = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.enum(["hot", "warm", "cold"]).optional()
);

const initialStatusSchema = z.enum([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED_TO_DEAL",
  "NOT_QUALIFIED",
  "NEGOTIATING",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
]);

const bodySchema = z.object({
  priority: prioritySchema,
  initialStatus: initialStatusSchema.optional(),
});

describe("manual lead intake", () => {
  it("accepts referral payloads with hot priority and qualified stage", () => {
    const parsed = bodySchema.safeParse({
      priority: "hot",
      initialStatus: "QUALIFIED",
    });
    assert.equal(parsed.success, true);
  });

  it("allows missing priority and rejects empty strings", () => {
    assert.equal(bodySchema.safeParse({ initialStatus: "NEW" }).success, true);
    assert.equal(bodySchema.safeParse({ priority: "", initialStatus: "NEW" }).success, true);
    assert.equal(
      bodySchema.safeParse({ priority: "", initialStatus: "NEW" }).data?.priority,
      undefined
    );
    assert.equal(bodySchema.safeParse({ priority: "nope", initialStatus: "NEW" }).success, false);
  });

  it("maps manual priority to score bands used in the leads directory", () => {
    assert.equal(scoreFromManualPriority("hot"), 75);
    assert.equal(scoreFromManualPriority("warm"), 55);
    assert.equal(scoreFromManualPriority("cold"), 30);
    assert.equal(scoreFromManualPriority(undefined), undefined);
  });

  it("includes qualified in manual stage options", () => {
    assert.ok(MANUAL_LEAD_STAGES.some((stage) => stage.value === "QUALIFIED"));
  });
});
