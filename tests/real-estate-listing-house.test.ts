import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listingFinishGaps, sellerLetterLabel } from "../lib/real-estate/listing-house";

describe("listing finish gaps", () => {
  it("asks for the house details a mandate can leave blank", () => {
    assert.deepEqual(
      listingFinishGaps({ address: "12 Samora", price: 90000, description: null, photos: [], property_category: "house", bedrooms: 3, bathrooms: null }),
      ["Description is still blank.", "Photos are still to add.", "Bathrooms are still blank."]
    );
  });

  it("treats a finished house as ready", () => {
    assert.deepEqual(
      listingFinishGaps({
        address: "12 Samora",
        price: 90000,
        description: "Quiet street.",
        photos: ["https://example.com/a.jpg"],
        property_category: "house",
        bedrooms: 3,
        bathrooms: 2,
      }),
      []
    );
  });

  it("does not ask for bedrooms on a stand", () => {
    assert.deepEqual(
      listingFinishGaps({
        address: "Stand 4",
        price: 20000,
        description: "Serviced stand.",
        photos: ["https://example.com/a.jpg"],
        property_category: "residential_stand",
        bedrooms: null,
        bathrooms: null,
      }),
      []
    );
  });
});

describe("seller letter", () => {
  it("shows when the seller has the letter", () => {
    assert.equal(sellerLetterLabel({ status: "draft", acceptanceChannel: "seller_link", revisionStatus: "draft" }), "The buyer still has the letter");
    assert.equal(sellerLetterLabel({ status: "submitted", acceptanceChannel: "seller_link", revisionStatus: "buyer_signed" }), "With the seller to approve");
    assert.equal(sellerLetterLabel({ status: "accepted", acceptanceChannel: "seller_link", revisionStatus: "buyer_signed" }), "Seller approved");
    assert.equal(sellerLetterLabel({ status: "submitted", acceptanceChannel: null, revisionStatus: null }), "The letter has not been sent to the seller");
  });
});
