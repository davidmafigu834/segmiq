import assert from "node:assert/strict";
import test from "node:test";
import { generateAuthorisedSignatureKey, isPngSignature } from "../lib/quotations/authorised-signature";

test("authorised signature uploads must be PNG", () => {
  assert.equal(isPngSignature("image/png"), true);
  assert.equal(isPngSignature("image/png;charset=utf-8"), true);
  assert.equal(isPngSignature("image/jpeg"), false);
  assert.equal(isPngSignature(""), false);
});

test("signature storage keys stay under the company quotation prefix", () => {
  const key = generateAuthorisedSignatureKey("client-1");
  assert.match(key, /^clients\/client-1\/quotations\/signature\/\d+\.png$/);
});
