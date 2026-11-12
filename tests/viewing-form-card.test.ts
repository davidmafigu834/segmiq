import assert from "node:assert/strict";
import test from "node:test";
import { viewingFormCard, viewingParty, viewingPhotoKeys, viewingSignatureAccepted } from "../lib/real-estate/workflow/viewing-form";

test("viewing form card uses recorded property facts and leaves out a price with no currency", () => {
  const card = viewingFormCard({
    agencyName: "Nyasha Estates",
    contactName: "Nyasha Moyo",
    address: "2 Baines Avenue",
    suburb: "Avondale",
    description: "Quiet avenue, garden at the back.",
    price: 185000,
    currency: null,
    bedrooms: 4,
    bathrooms: 2,
    sizeSqm: 220,
    transactionType: "sale",
    propertyCategory: "house",
  });
  assert.equal(card.sentBy, "Nyasha Moyo sent this");
  assert.equal(card.heading, "2 Baines Avenue");
  assert.equal(card.placeLine, "Avondale. House for sale.");
  assert.equal(card.note, "Quiet avenue, garden at the back.");
  assert.deepEqual(card.facts.map((fact) => fact.label), ["Beds", "Baths", "Size"]);
  assert.equal(card.facts.find((fact) => fact.label === "Size")?.value, "220 m²");
});

test("viewing form card prices only when the agency currency is set", () => {
  const card = viewingFormCard({
    agencyName: "Nyasha Estates",
    contactName: null,
    address: null,
    suburb: "Avondale",
    description: null,
    price: 185000,
    currency: "USD",
    bedrooms: null,
    bathrooms: null,
    sizeSqm: null,
    transactionType: null,
    propertyCategory: null,
  });
  assert.equal(card.sentBy, "Nyasha Estates sent this");
  assert.equal(card.heading, "Avondale");
  assert.equal(card.placeLine, null);
  assert.deepEqual(card.facts, [{ label: "Asking", value: "USD 185,000" }]);
});

test("viewing signature accepts a drawn PNG and a short typed name", () => {
  assert.equal(viewingSignatureAccepted("data:image/png;base64," + "A".repeat(20)), true);
  assert.equal(viewingSignatureAccepted("data:image/png;base64,abc"), false);
  assert.equal(viewingSignatureAccepted("Tariro Ncube"), true);
  assert.equal(viewingSignatureAccepted("x"), false);
  assert.equal(viewingParty("A family"), "A family");
  assert.equal(viewingParty("a crowd"), null);
  assert.deepEqual(
    viewingPhotoKeys(
      ["clients/c1/listings/l1/photos/front.jpg", "https://example.com/other.jpg", "notes.txt"],
      "c1",
      "l1",
    ),
    ["clients/c1/listings/l1/photos/front.jpg"],
  );
});
