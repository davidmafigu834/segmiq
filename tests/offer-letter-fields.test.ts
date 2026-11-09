import assert from "node:assert/strict";
import test from "node:test";
import { offerLetterFields } from "../lib/real-estate/workflow/journey-links";

test("offer letter keeps the purchaser fields from the form and drops anything else", () => {
  const letter = offerLetterFields({
    amountWords: "  One hundred and eighty five thousand dollars  ",
    payableOn: "2026-12-01",
    surname: "Dube",
    pep: "no",
    witness: "A. Ncube",
    sellerPath: "/journey/secret",
    amount: 185000,
  });
  assert.deepEqual(letter, {
    amountWords: "One hundred and eighty five thousand dollars",
    payableOn: "2026-12-01",
    surname: "Dube",
    pep: "no",
    witness: "A. Ncube",
  });
});
