import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listingWorkBadge, listingWorkCounts, listingWorkVisible, type ListingWorkRow } from "../lib/real-estate/listing-work";

function row(overrides: Partial<ListingWorkRow> = {}): ListingWorkRow {
  return {
    id: "house-1",
    address: "12 Samora",
    suburb: "Borrowdale",
    price: 90000,
    bedrooms: 3,
    bathrooms: 2,
    description: "Quiet street.",
    hasPhotos: true,
    propertyCategory: "house",
    status: "available",
    transactionType: "sale",
    sellerName: "Tendai Moyo",
    sellerId: "seller-1",
    viewingCount: 0,
    offerCount: 0,
    ...overrides,
  };
}

describe("listing work list", () => {
  it("marks a house still to finish when photos are missing", () => {
    const house = row({ hasPhotos: false, description: null });
    assert.equal(listingWorkBadge(house).label, "Still to finish");
    assert.equal(listingWorkVisible(house, "finish", ""), true);
    assert.equal(listingWorkVisible(house, "ready", ""), false);
  });

  it("marks a finished available house ready", () => {
    const house = row();
    assert.equal(listingWorkBadge(house).label, "Ready");
    assert.equal(listingWorkVisible(house, "ready", ""), true);
    assert.equal(listingWorkVisible(house, "finish", ""), false);
  });

  it("keeps an unfinished offer in both finish and under offer", () => {
    const house = row({ status: "under_offer", hasPhotos: false });
    assert.equal(listingWorkBadge(house).label, "Under offer");
    assert.equal(listingWorkVisible(house, "under_offer", ""), true);
    assert.equal(listingWorkVisible(house, "finish", ""), true);
    assert.equal(listingWorkVisible(house, "ready", ""), false);
  });

  it("searches the seller and counts viewings and offers", () => {
    const house = row({ viewingCount: 2, offerCount: 1 });
    assert.equal(listingWorkVisible(house, "all", "tendai"), true);
    assert.equal(listingWorkVisible(house, "all", "avondale"), false);
    assert.equal(listingWorkCounts(house), "2 viewings · 1 offer");
    assert.equal(listingWorkCounts(row()), "No viewings or offers yet");
  });

  it("groups sold and rented houses together", () => {
    assert.equal(listingWorkBadge(row({ status: "sold" })).label, "Sold");
    assert.equal(listingWorkVisible(row({ status: "let" }), "closed", ""), true);
    assert.equal(listingWorkVisible(row({ status: "sold", hasPhotos: false }), "finish", ""), false);
  });
});
