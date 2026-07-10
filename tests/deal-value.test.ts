import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canEnterManualDealValue,
  canSetManualDealValue,
  isDealValueLocked,
  manualDealValueUpdate,
  proposalDealValueUpdate,
} from "../lib/deal-value";

describe("deal value source locking", () => {
  it("locks proposal-sourced values", () => {
    assert.equal(isDealValueLocked("proposal"), true);
    assert.equal(canSetManualDealValue("proposal"), false);
  });

  it("allows manual edits when source is manual or unset", () => {
    assert.equal(canSetManualDealValue("manual"), true);
    assert.equal(canSetManualDealValue(null), true);
    assert.equal(canSetManualDealValue(undefined), true);
  });
});

describe("manualDealValueUpdate", () => {
  it("tags positive values as manual", () => {
    assert.deepEqual(manualDealValueUpdate(3200), {
      deal_value: 3200,
      deal_value_source: "manual",
    });
  });

  it("clears value and source when null or zero", () => {
    assert.deepEqual(manualDealValueUpdate(null), {
      deal_value: null,
      deal_value_source: null,
    });
    assert.deepEqual(manualDealValueUpdate(0), {
      deal_value: null,
      deal_value_source: null,
    });
  });
});

describe("proposalDealValueUpdate", () => {
  it("tags quotation totals as proposal", () => {
    assert.deepEqual(proposalDealValueUpdate(4500.5), {
      deal_value: 4500.5,
      deal_value_source: "proposal",
    });
  });

  it("returns null for non-positive totals", () => {
    assert.equal(proposalDealValueUpdate(0), null);
    assert.equal(proposalDealValueUpdate(-1), null);
  });
});

describe("canEnterManualDealValue", () => {
  it("allows contacted through proposal-sent", () => {
    assert.equal(canEnterManualDealValue("CONTACTED"), true);
    assert.equal(canEnterManualDealValue("NEGOTIATING"), true);
    assert.equal(canEnterManualDealValue("PROPOSAL_SENT"), true);
    assert.equal(canEnterManualDealValue("NEW"), false);
    assert.equal(canEnterManualDealValue("WON"), false);
  });
});
