import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateLeadModifyAccess } from "../lib/auth/permissions";
import { analyseConversation } from "../lib/sales-copilot/analyse";
import { reconcileProposals } from "../lib/sales-copilot/reconcile";
import { payloadHash } from "../lib/sales-copilot/hash";
import { existingLocalDay, resolveCommitmentWhen } from "../lib/sales-copilot/dates";
import type { CopilotEngineInput, ProposalDraft } from "../lib/sales-copilot/types";

const TZ = "Africa/Harare";

function baseInput(overrides: Partial<CopilotEngineInput> = {}): CopilotEngineInput {
  return {
    timezone: TZ,
    defaultHour: 9,
    contactLaterDays: 7,
    checkinOffsetDays: 1,
    capabilities: {
      quotations: true,
      listings: false,
      appointments: false,
      reminders: true,
      stock: true,
    },
    requiredFields: [
      { key: "size", label: "Tyre size" },
      { key: "brand", label: "Brand" },
      { key: "quantity", label: "Quantity" },
      { key: "branch", label: "Branch" },
    ],
    knownFacts: { size: "205/55R16", brand: "Michelin", branch: "Harare" },
    catalogue: [
      {
        id: "p-michelin",
        name: "Michelin Pilot 205/55R16",
        sku: "M205",
        brand: "Michelin",
        size: "205/55R16",
        unitPrice: 80,
        stockQty: 12,
      },
      {
        id: "p-bridge",
        name: "Bridgestone Turanza 205/55R16",
        sku: "B205",
        brand: "Bridgestone",
        size: "205/55R16",
        unitPrice: 75,
        stockQty: null,
      },
    ],
    listings: [],
    stage: "PROPOSAL_SENT",
    followUpAt: "2026-10-16",
    quoteStatus: null,
    doNotContact: false,
    messages: [],
    ...overrides,
  };
}

describe("Sales Copilot dates", () => {
  it("resolves tomorrow from the original message time, not a later run", () => {
    const messageAt = new Date("2026-10-08T14:00:00.000Z");
    const resolved = resolveCommitmentWhen("I'll contact you tomorrow", messageAt, TZ, 9);
    assert.ok(resolved);
    assert.equal(resolved.ymd, "2026-10-09");
    assert.equal(resolved.hourSuggested, true);
    assert.equal(resolved.dayLabel, "tomorrow");
    const later = resolveCommitmentWhen("I'll contact you tomorrow", messageAt, TZ, 9);
    assert.equal(later?.ymd, resolved.ymd);
  });

  it("keeps an explicit hour", () => {
    const resolved = resolveCommitmentWhen(
      "I'll call you tomorrow at 3pm",
      new Date("2026-10-08T14:00:00.000Z"),
      TZ,
      9
    );
    assert.equal(resolved?.hourSuggested, false);
    assert.equal(existingLocalDay(resolved!.at, TZ), "2026-10-09");
  });
});

describe("Sales Copilot analysis", () => {
  it("proposes a reminder update for a salesperson promise and leaves the follow-up conceptual open", () => {
    const analysis = analyseConversation(
      baseInput({
        messages: [
          {
            id: "m1",
            direction: "outbound",
            body: "I'll contact you tomorrow.",
            createdAt: "2026-10-08T14:00:00.000Z",
            status: "sent",
            authorId: "rep",
            authorName: "Ada",
          },
        ],
      })
    );
    const proposal = analysis.proposals.find((item) => item.actionType === "update_reminder");
    assert.ok(proposal);
    assert.match(proposal.explanation, /promised to contact/i);
    assert.match(proposal.explanation, /Friday/i);
    assert.equal(proposal.hourSuggested, true);
    assert.equal(proposal.linkedFollowUp, true);
    assert.equal(proposal.queue, "needs_review");
    assert.notEqual(proposal.payload.followUpAt, null);
  });

  it("treats a customer reply promise as their commitment, not the salesperson's", () => {
    const analysis = analyseConversation(
      baseInput({
        followUpAt: null,
        messages: [
          {
            id: "c1",
            direction: "inbound",
            body: "I'll get back to you tomorrow.",
            createdAt: "2026-10-08T14:00:00.000Z",
            status: "received",
            authorId: null,
            authorName: "Customer",
          },
        ],
      })
    );
    assert.equal(analysis.proposals.some((item) => item.actionType === "update_reminder"), false);
    const checkin = analysis.proposals.find((item) => item.actionType === "customer_checkin");
    assert.ok(checkin);
    assert.equal(checkin.waitingActor, "customer");
    assert.match(checkin.explanation, /not contacting them before/i);
    assert.equal(existingLocalDay(String(checkin.payload.followUpAt), TZ), "2026-10-10");
  });

  it("does not invent a deadline for an undated stock check", () => {
    const analysis = analyseConversation(
      baseInput({
        messages: [
          {
            id: "s1",
            direction: "outbound",
            body: "I'll check stock.",
            createdAt: "2026-10-08T14:00:00.000Z",
            status: "sent",
            authorId: "rep",
            authorName: "Ada",
          },
        ],
      })
    );
    const open = analysis.proposals.find((item) => item.actionType === "open_commitment");
    assert.ok(open);
    assert.equal(open.proposedAt, null);
  });

  it("ignores failed outbound text and unsent status", () => {
    const analysis = analyseConversation(
      baseInput({
        messages: [
          {
            id: "bad",
            direction: "outbound",
            body: "I'll contact you tomorrow.",
            createdAt: "2026-10-08T14:00:00.000Z",
            status: "failed",
            authorId: "rep",
            authorName: "Ada",
          },
        ],
      })
    );
    assert.equal(analysis.proposals.length, 0);
  });

  it("prepares a tyre quotation only when the catalogue match and quantity are explicit", () => {
    const analysis = analyseConversation(
      baseInput({
        knownFacts: { size: "205/55R16", brand: "Michelin", quantity: "4", branch: "Harare" },
        messages: [
          {
            id: "q1",
            direction: "inbound",
            body: "Please quote 4 Michelin Pilot 205/55R16 tyres.",
            createdAt: "2026-10-08T14:00:00.000Z",
            status: "received",
            authorId: null,
            authorName: null,
          },
        ],
      })
    );
    const draft = analysis.proposals.find((item) => item.actionType === "quotation_draft");
    assert.ok(draft);
    assert.equal(draft.missing.length, 0);
    const items = draft.payload.items as Array<{ productId: string; quantity: number }>;
    assert.equal(items[0].productId, "p-michelin");
    assert.equal(items[0].quantity, 4);
    assert.match(draft.explanation, /Available stock: 12/);
  });

  it("asks the salesperson to choose when two tyre brands match", () => {
    const analysis = analyseConversation(
      baseInput({
        knownFacts: { size: "205/55R16", quantity: "4", branch: "Harare" },
        messages: [
          {
            id: "q2",
            direction: "inbound",
            body: "Can I get a quote for 4 205/55R16 tyres?",
            createdAt: "2026-10-08T14:00:00.000Z",
            status: "received",
            authorId: null,
            authorName: null,
          },
        ],
      })
    );
    const choice = analysis.proposals.find((item) => item.actionType === "quotation_choice");
    assert.ok(choice);
    assert.equal(analysis.proposals.some((item) => item.actionType === "quotation_draft"), false);
  });

  it("uses the same engine for a property enquiry without forcing a quotation", () => {
    const analysis = analyseConversation(
      baseInput({
        capabilities: {
          quotations: false,
          listings: true,
          appointments: true,
          reminders: true,
          stock: false,
        },
        requiredFields: [
          { key: "intent", label: "Sale or rental" },
          { key: "location", label: "Location" },
          { key: "budget", label: "Budget" },
        ],
        knownFacts: { intent: "rent", location: "Borrowdale" },
        catalogue: [],
        listings: [
          { id: "l1", name: "Borrowdale cottage", location: "Borrowdale", intent: "rent" },
          { id: "l2", name: "Avondale flat", location: "Avondale", intent: "rent" },
        ],
        stage: "QUALIFIED",
        messages: [
          {
            id: "r1",
            direction: "inbound",
            body: "I want to rent in Borrowdale. Can we set a viewing?",
            createdAt: "2026-10-08T14:00:00.000Z",
            status: "received",
            authorId: null,
            authorName: null,
          },
        ],
      })
    );
    assert.equal(analysis.proposals.some((item) => item.actionType.startsWith("quotation")), false);
    const viewing = analysis.proposals.find((item) => item.actionType === "appointment" || item.actionType === "listing_shortlist");
    assert.ok(viewing);
    assert.match(viewing.explanation, /viewing|listing/i);
  });

  it("suggests contact later with the company default when no date was given", () => {
    const analysis = analyseConversation(
      baseInput({
        followUpAt: null,
        messages: [
          {
            id: "cmp",
            direction: "inbound",
            body: "I am still comparing other suppliers and the warranty.",
            createdAt: "2026-10-08T14:00:00.000Z",
            status: "received",
            authorId: null,
            authorName: null,
          },
        ],
      })
    );
    const later = analysis.proposals.find((item) => item.actionType === "contact_later");
    assert.ok(later);
    assert.match(later.explanation, /company default of 7 days/);
    assert.equal(later.hourSuggested, true);
    assert.equal(existingLocalDay(String(later.payload.followUpAt), TZ), "2026-10-15");
  });

  it("does not propose contact after an opt-out", () => {
    const analysis = analyseConversation(
      baseInput({
        messages: [
          {
            id: "stop",
            direction: "inbound",
            body: "Please stop messaging me",
            createdAt: "2026-10-08T14:00:00.000Z",
            status: "received",
            authorId: null,
            authorName: null,
          },
        ],
      })
    );
    assert.equal(analysis.proposals.length, 0);
  });
});

describe("Sales Copilot reconcile", () => {
  const proposal = analyseConversation(
    baseInput({
      messages: [
        {
          id: "m1",
          direction: "outbound",
          body: "I'll contact you tomorrow.",
          createdAt: "2026-10-08T14:00:00.000Z",
          status: "sent",
          authorId: "rep",
          authorName: "Ada",
        },
      ],
    })
  ).proposals[0] as ProposalDraft;

  const hash = payloadHash({
    actionType: proposal.actionType,
    proposedAt: proposal.proposedAt,
    payload: proposal.payload,
    missing: proposal.missing,
  });

  it("revises the same suggestion instead of duplicating it", () => {
    const once = reconcileProposals({
      proposals: [proposal],
      existing: [],
      fulfilledKeys: [],
      contextRevision: "rev1",
      loadedMessageIds: ["m1"],
    });
    assert.equal(once.upserts.length, 1);
    const again = reconcileProposals({
      proposals: [proposal],
      existing: [
        {
          id: "item-1",
          semanticKey: proposal.semanticKey,
          payloadHash: hash,
          reviewStatus: "pending",
          executionStatus: "none",
          fulfilmentStatus: "open",
          contextRevision: "rev1",
          evidenceMessageIds: ["m1"],
        },
      ],
      fulfilledKeys: [],
      contextRevision: "rev2",
      loadedMessageIds: ["m1"],
    });
    assert.equal(again.upserts.length, 1);
    assert.equal(again.upserts[0].id, "item-1");
  });

  it("does not recreate a dismissed suggestion when nothing changed", () => {
    const result = reconcileProposals({
      proposals: [proposal],
      existing: [
        {
          id: "item-1",
          semanticKey: proposal.semanticKey,
          payloadHash: hash,
          reviewStatus: "dismissed",
          executionStatus: "none",
          fulfilmentStatus: "open",
          contextRevision: "rev1",
          evidenceMessageIds: ["m1"],
        },
      ],
      fulfilledKeys: [],
      contextRevision: "rev2",
      loadedMessageIds: ["m1"],
    });
    assert.equal(result.upserts.length, 0);
  });

  it("marks an approved payload stale when the request changes", () => {
    const changed: ProposalDraft = {
      ...proposal,
      proposedAt: "2026-10-12T07:00:00.000Z",
      payload: { ...proposal.payload, followUpAt: "2026-10-12T07:00:00.000Z" },
    };
    const result = reconcileProposals({
      proposals: [changed],
      existing: [
        {
          id: "item-1",
          semanticKey: proposal.semanticKey,
          payloadHash: hash,
          reviewStatus: "approved",
          executionStatus: "none",
          fulfilmentStatus: "open",
          contextRevision: "rev1",
          evidenceMessageIds: ["m1"],
        },
      ],
      fulfilledKeys: [],
      contextRevision: "rev2",
      loadedMessageIds: ["m1"],
    });
    assert.deepEqual(result.staleIds, ["item-1"]);
    assert.equal(result.upserts.some((item) => item.id == null), true);
  });

  it("keeps a salesperson's catalogue choice instead of opening a new one", () => {
    const result = reconcileProposals({
      proposals: [proposal],
      existing: [
        {
          id: "item-1",
          semanticKey: proposal.semanticKey,
          payloadHash: hash,
          reviewStatus: "pending",
          executionStatus: "succeeded",
          fulfilmentStatus: "open",
          contextRevision: "rev1",
          evidenceMessageIds: ["m1"],
          salespersonChoice: true,
          chosenId: "kept",
        },
      ],
      fulfilledKeys: [],
      contextRevision: "rev2",
      loadedMessageIds: ["m1"],
    });
    assert.equal(result.upserts.length, 0);
    assert.equal(result.obsoleteIds.includes("item-1"), false);
  });
});

describe("Sales Copilot access", () => {
  it("rejects a salesperson from another company", () => {
    const result = evaluateLeadModifyAccess(
      { userId: "user-1", role: "SALESPERSON", clientId: "company-a" },
      { client_id: "company-b", assigned_to_id: "user-1" }
    );
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.status, 404);
  });

  it("lets a manager who sells act only on leads they own", () => {
    const own = evaluateLeadModifyAccess(
      { userId: "manager-1", role: "CLIENT_MANAGER", clientId: "company-a", alsoSells: true },
      { client_id: "company-a", assigned_to_id: "manager-1" }
    );
    const other = evaluateLeadModifyAccess(
      { userId: "manager-1", role: "CLIENT_MANAGER", clientId: "company-a", alsoSells: true },
      { client_id: "company-a", assigned_to_id: "rep-2" }
    );
    assert.equal(own.allowed, true);
    assert.equal(other.allowed, false);
  });

  it("keeps a manager who does not sell read-only", () => {
    const result = evaluateLeadModifyAccess(
      { userId: "manager-1", role: "CLIENT_MANAGER", clientId: "company-a", alsoSells: false },
      { client_id: "company-a", assigned_to_id: "manager-1" }
    );
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.status, 403);
  });
});
