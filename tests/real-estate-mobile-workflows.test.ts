import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canApproveListings, canSubmitListings, defaultApprovalForCreate } from "../lib/real-estate/listings";
import { canAssignListingAgent, canReadListing, listingActions } from "../lib/real-estate/listing-access";
import { matchCompatibility, type MatchListing, type MatchSearch } from "../lib/real-estate/buyer-match";
import { buyerSearchMobileDto, bearerListingPhotoError, copilotConversationContract, listingBuyerMatchAccess } from "../lib/real-estate/mobile-workflows";
import { canReviewIntroduction, introductionRequirementsSummary } from "../lib/real-estate/buyer-introduction-review";
import { viewingReplayMatches } from "../lib/real-estate/viewing-access";
import { detectPrivateListingImage, PRIVATE_LISTING_IMAGE_MAX_BYTES, putPrivateListingImage } from "../lib/real-estate/private-listing-images";

const agent = { userId: "agent-a", role: "SALESPERSON", clientId: "org-a" };
const ownDraft = { client_id: "org-a", agent_id: "agent-a", approval_status: "draft" };

function search(patch: Partial<MatchSearch> = {}): MatchSearch {
  return {
    id: "search-1", clientId: "org-a", contactId: "contact-1", intent: "purchase", status: "active",
    pipelineStage: "actively_searching", propertyType: "house", budgetMin: null, budgetMax: 120000,
    locations: ["Greendale"], bedrooms: 3, bathrooms: 2, allowAboveBudget: false, allowAlternateLocations: true,
    ...patch,
  };
}
function listing(patch: Partial<MatchListing> = {}): MatchListing {
  return {
    id: "listing-1", clientId: "org-a", transactionType: "sale", status: "available", approvalStatus: "approved",
    price: 100000, suburb: "Greendale", bedrooms: 3, bathrooms: 2, sizeSqm: 180, propertyType: "house",
    propertyCategory: "house", ...patch,
  };
}

test("an agent can create a listing but cannot approve or publish it", () => {
  assert.equal(canSubmitListings("SALESPERSON"), true);
  assert.equal(canApproveListings("SALESPERSON"), false);
  assert.equal(defaultApprovalForCreate("SALESPERSON"), "pending_approval");
  assert.equal(defaultApprovalForCreate("CLIENT_MANAGER"), "approved");
  assert.equal(listingActions(agent, ownDraft).edit, true);
  assert.equal(listingActions(agent, { ...ownDraft, approval_status: "approved" }).edit, false);
  assert.equal(listingActions(agent, { ...ownDraft, approval_status: "approved" }).approve, false);
  assert.equal(canAssignListingAgent(agent, "agent-b"), false);
  assert.equal(canAssignListingAgent({ ...agent, role: "CLIENT_MANAGER" }, "agent-b"), true);
});

test("buyer creation projection keeps the id and phone for the owner only", () => {
  const row = {
    id: "search-1", client_id: "org-a", contact_id: "contact-1", assigned_agent_id: "agent-a",
    intent: "purchase", budget_min: 1000, budget_max: 5000, locations: ["Avondale"], bedrooms: 2,
    bathrooms: 1, other_requirements: "garden", features: "pool", status: "active", pipeline_stage: "new_enquiry",
    secret_column: "do-not-leak",
  };
  const own = buyerSearchMobileDto(row, { id: "agent-a", role: "SALESPERSON" }, { name: "Amina", phone: "+263700000001" }, "Amina Agent");
  assert.equal(own.id, "search-1");
  assert.equal(own.phone, "+263700000001");
  assert.equal(own.contact_name, "Amina");
  assert.equal(own.status, "active");
  assert.equal(own.secret_column, undefined);
  assert.deepEqual(own.permittedActions, ["edit"]);
  const other = buyerSearchMobileDto(row, { id: "agent-b", role: "SALESPERSON" }, { name: "Amina", phone: "+263700000001" });
  assert.equal(other.id, "search-1");
  assert.equal(other.phone, undefined);
  assert.equal(other.contact_name, undefined);
  assert.equal(other.budget_max, undefined);
  assert.equal(other.locations, undefined);
  assert.equal(other.features, undefined);
  assert.deepEqual(other.permittedActions, []);
  assert.equal(canReadListing(agent, { ...ownDraft, client_id: "org-b" }), false);
});

test("listing matches expose compatibility and a request action without private requirements", () => {
  const flags = matchCompatibility(search(), listing());
  assert.equal(flags.budgetCompatible, true);
  assert.equal(flags.locationCompatible, true);
  assert.equal(flags.requirementsCompatible, true);
  const above = matchCompatibility(search(), listing({ price: 150000 }));
  assert.equal(above.budgetCompatible, false);
  const card = listingBuyerMatchAccess({
    actorId: "agent-b", actorRole: "SALESPERSON", ownerAgentId: "agent-a", visible: false,
    introductionStatus: null, searchStatus: "active", ...flags,
  });
  assert.equal(card.relationship, "other_agent");
  assert.deepEqual(card.permittedActions, ["request_introduction"]);
  assert.equal(card.scoreMeaning, "rules_points");
  assert.equal("budgetMax" in card, false);
  assert.equal("locations" in card, false);
  assert.equal("phone" in card, false);
  const own = listingBuyerMatchAccess({
    actorId: "agent-a", actorRole: "SALESPERSON", ownerAgentId: "agent-a", visible: true,
    introductionStatus: null, searchStatus: "active", ...flags,
  });
  assert.equal(own.relationship, "own");
  assert.deepEqual(own.permittedActions, ["open_buyer"]);
});

test("introduction review rejects self-approval and hides private requirements from the requester", () => {
  const self = canReviewIntroduction({ actorId: "agent-b", actorRole: "SALESPERSON", requesterId: "agent-b", currentAssigneeId: "agent-a", assigneeActive: true });
  assert.equal(self.ok, false);
  const owner = canReviewIntroduction({ actorId: "agent-a", actorRole: "SALESPERSON", requesterId: "agent-b", currentAssigneeId: "agent-a", assigneeActive: true });
  assert.equal(owner.ok, true);
  const reassigned = canReviewIntroduction({ actorId: "agent-a", actorRole: "SALESPERSON", requesterId: "agent-b", currentAssigneeId: "agent-c", assigneeActive: true });
  assert.equal(reassigned.ok, false);
  assert.equal(introductionRequirementsSummary({ ownRequest: true, actorRole: "SALESPERSON", summary: "Avondale · Up to 5000 · 3 bedrooms" }), "");
  assert.equal(introductionRequirementsSummary({ ownRequest: false, actorRole: "SALESPERSON", summary: "Avondale · Up to 5000" }), "Avondale · Up to 5000");
  assert.equal(introductionRequirementsSummary({ ownRequest: true, actorRole: "CLIENT_MANAGER", summary: "Avondale" }), "Avondale");
});

test("viewing idempotency accepts only the same booking", () => {
  const existing = { buyer_search_id: "search-1", listing_id: "listing-1", scheduled_at: "2026-12-01T09:00:00.000Z", agent_id: "agent-a", instructions: null };
  const requested = { searchId: "search-1", listingId: "listing-1", scheduledAt: "2026-12-01T11:00:00.000+02:00", agentId: "agent-a", instructions: null };
  assert.equal(viewingReplayMatches(existing, requested), true);
  assert.equal(viewingReplayMatches(existing, { ...requested, listingId: "listing-2" }), false);
  assert.equal(viewingReplayMatches(existing, { ...requested, searchId: "search-2" }), false);
});

test("private listing photographs reject public urls, the public bucket, and non-images", async () => {
  assert.deepEqual(bearerListingPhotoError(["https://example.test/cover.jpg"], "org-a", "listing-1")?.code, "USE_PRIVATE_IMAGE_UPLOAD");
  assert.equal(bearerListingPhotoError(["clients/org-a/listings/listing-1/photos/cover.jpg"], "org-a", "listing-1"), null);
  assert.equal(bearerListingPhotoError(["clients/org-b/listings/listing-1/photos/cover.jpg"], "org-a", "listing-1")?.code, "USE_PRIVATE_IMAGE_UPLOAD");
  const jpeg = detectPrivateListingImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]));
  assert.equal(jpeg.ok && jpeg.mime, "image/jpeg");
  assert.equal(detectPrivateListingImage(Uint8Array.from([])).ok, false);
  assert.equal(detectPrivateListingImage(Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c])).ok, false);
  const huge = { length: PRIVATE_LISTING_IMAGE_MAX_BYTES + 1 } as Uint8Array;
  assert.equal(detectPrivateListingImage(huge).ok, false);
  const previous = {
    privateBucket: process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME,
    publicBucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    account: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    key: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secret: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  };
  process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME = "public-media";
  process.env.CLOUDFLARE_R2_BUCKET_NAME = "public-media";
  process.env.CLOUDFLARE_R2_ACCOUNT_ID = "account";
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "key";
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "secret";
  await assert.rejects(() => putPrivateListingImage("clients/org-a/listings/listing-1/photos/a.jpg", Buffer.from([1]), "image/jpeg"));
  process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME = "private-listings";
  await assert.rejects(() => putPrivateListingImage("https://cdn.example.test/a.jpg", Buffer.from([1]), "image/jpeg"));
  for (const [name, value] of Object.entries(previous)) {
    const envName = name === "privateBucket" ? "CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME"
      : name === "publicBucket" ? "CLOUDFLARE_R2_BUCKET_NAME"
      : name === "account" ? "CLOUDFLARE_R2_ACCOUNT_ID"
      : name === "key" ? "CLOUDFLARE_R2_ACCESS_KEY_ID"
      : "CLOUDFLARE_R2_SECRET_ACCESS_KEY";
    if (value === undefined) delete process.env[envName];
    else process.env[envName] = value;
  }
});

test("conversation copilot never claims a customer message was sent", () => {
  const contract = copilotConversationContract("11111111-1111-4111-8111-111111111111");
  assert.equal(contract.conversation.scope, "assigned_conversation");
  assert.equal(contract.sendsCustomerMessage, false);
  assert.equal(contract.customerDelivery, "NOT_PERFORMED");
  assert.equal(contract.approvalRequired, true);
  assert.equal(contract.suggestedResponsesAreDrafts, true);
  const execution = readFileSync(new URL("../lib/sales-copilot/execute.ts", import.meta.url), "utf8");
  assert.equal(/sendMessage|whatsapp|send-message/i.test(execution), false);
});
