import assert from "node:assert/strict";
import test from "node:test";
import { viewingAccentInk, viewingPropertyCard } from "../lib/real-estate/workflow/viewing-form";

test("viewing card uses the listing address, price, and house facts", () => {
  const card = viewingPropertyCard({
    address: "12 Baines Avenue",
    suburb: "Avondale",
    price: 185000,
    currency: "USD",
    currencyConfigured: true,
    transactionType: "sale",
    propertyCategory: "house",
    bedrooms: 3,
    bathrooms: 2,
    description: "Double lock-up garage, borehole, and a walled garden.",
    photoUrl: "/api/public/journey/token/photo",
  });
  assert.equal(card.heading, "12 Baines Avenue");
  assert.equal(card.place, "Avondale");
  assert.equal(card.priceLabel, "USD 185,000");
  assert.equal(card.priceOnRequest, false);
  assert.equal(card.categoryLabel, "House");
  assert.equal(card.transactionLabel, "For sale");
  assert.equal(card.bedrooms, 3);
  assert.equal(card.bathrooms, 2);
  assert.equal(card.description, "Double lock-up garage, borehole, and a walled garden.");
  assert.equal(card.photoUrl, "/api/public/journey/token/photo");
});

test("a listing without a configured currency does not print a bare price", () => {
  const card = viewingPropertyCard({
    address: "12 Baines Avenue, Avondale",
    suburb: "Avondale",
    price: 185000,
    currency: null,
    currencyConfigured: false,
    transactionType: "rental",
    propertyCategory: null,
    bedrooms: null,
    bathrooms: null,
    description: null,
    photoUrl: null,
  });
  assert.equal(card.priceLabel, null);
  assert.equal(card.priceOnRequest, true);
  assert.equal(card.place, null);
  assert.equal(card.transactionLabel, "To rent");
});

test("light agency colours keep dark button text", () => {
  assert.equal(viewingAccentInk("#D4FF4F"), "#171916");
  assert.equal(viewingAccentInk("#2f3a32"), "#f7f4ef");
});
