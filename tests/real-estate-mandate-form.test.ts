import assert from "node:assert/strict";
import test from "node:test";
import { mandateFormExpiring, mandateFormLabels, mandateFormPhase, mandateFormPlace, mandateFormVisible, mandateKindLabel } from "../lib/real-estate/mandate-form";

test("a finished seller form is complete and an unfinished one stays with the seller", () => {
  assert.equal(mandateFormPhase("draft_link"), "with_seller");
  assert.equal(mandateFormPhase("in_progress"), "with_seller");
  assert.equal(mandateFormPhase("submitted"), "complete");
  assert.equal(mandateFormPhase("accepted"), "complete");
  assert.equal(mandateFormPhase("review_incomplete"), "complete");
  assert.equal(mandateFormVisible({ phase: "with_seller", expiryDate: null }, "with_seller"), true);
  assert.equal(mandateFormVisible({ phase: "with_seller", expiryDate: null }, "complete"), false);
  assert.equal(mandateFormVisible({ phase: "complete", expiryDate: "2026-11-20" }, "expiring", new Date("2026-11-07T00:00:00Z")), true);
  assert.equal(mandateFormVisible({ phase: "complete", expiryDate: "2027-05-01" }, "expiring", new Date("2026-11-07T00:00:00Z")), false);
  assert.equal(mandateFormVisible({ phase: "with_seller", expiryDate: "2026-11-10" }, "expiring", new Date("2026-11-07T00:00:00Z")), false);
  assert.equal(mandateFormExpiring(null), false);
  assert.equal(mandateKindLabel("sole"), "Sole");
  assert.equal(mandateKindLabel("open"), "Open");
  assert.deepEqual(mandateFormLabels({ registeredOwner: "Rudo Moyo", propertyAddress: "12 Cork Road" }), {
    sellerName: "Rudo Moyo",
    property: "12 Cork Road",
  });
  assert.deepEqual(mandateFormLabels({}), { sellerName: "Seller", property: "Address not in yet" });
  assert.deepEqual(mandateFormPlace("12 Cork Road, Avondale, Harare"), { suburb: "Avondale", city: "Harare" });
});
