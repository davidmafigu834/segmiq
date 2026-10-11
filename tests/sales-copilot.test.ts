import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { evaluateLeadModifyAccess } from "../lib/auth/permissions";
import { analyseConversation, relevantQuotations } from "../lib/sales-copilot/analyse";
import { defaultRequiredFields } from "../lib/sales-copilot/catalogue";
import { reconcileProposals } from "../lib/sales-copilot/reconcile";
import { payloadHash } from "../lib/sales-copilot/hash";
import { existingLocalDay, followUpCalendarDate, formatLocalWhen, resolveCommitmentWhen } from "../lib/sales-copilot/dates";
import { carryCopilotSummary, readableCopilotSummary } from "../lib/sales-copilot/summary";
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

  it("keeps 8am as 8am instead of turning the saved day into 2pm", () => {
    const eightAmHarare = "2026-10-11T06:00:00.000Z";
    assert.equal(followUpCalendarDate(eightAmHarare, TZ), "2026-10-11");
    assert.match(formatLocalWhen(eightAmHarare, TZ, false), /08:00/);
    assert.equal(followUpCalendarDate("2026-10-10T23:00:00.000Z", TZ), "2026-10-11");
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
    assert.equal(draft.payload.onDemand, true);
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
    assert.match(later.explanation, /checking in after 7 days/);
    assert.match(later.explanation, /suggestion/);
    assert.equal(later.payload.onDemand, undefined);
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

describe("Sales Copilot summary", () => {
  it("shows a repeated empty summary once, as nothing to display", () => {
    const stacked = Array.from({ length: 5 }, () => "Earlier context: No action is waiting on this conversation.").join(" ");
    assert.equal(readableCopilotSummary(stacked), null);
  });

  it("keeps one earlier note instead of nesting the previous summary", () => {
    const previous = "Earlier context: Earlier context: Need: four tyres. No action is waiting on this conversation.";
    const next = carryCopilotSummary("No action is waiting on this conversation.", previous);
    assert.equal(next, "Need: four tyres.");
    assert.equal(carryCopilotSummary("The customer asked about delivery.", next), "Earlier context: Need: four tyres. The customer asked about delivery.");
  });
});

describe("Sales Copilot quotation reasoning", () => {
  const sent = {
    id: "out-1",
    direction: "outbound" as const,
    createdAt: "2026-10-08T14:00:00.000Z",
    status: "sent",
    authorId: "rep",
    authorName: "Ada",
  };
  const customer = {
    id: "in-1",
    direction: "inbound" as const,
    createdAt: "2026-10-08T13:00:00.000Z",
    status: "received",
    authorId: null,
    authorName: "Customer",
  };

  it("does not treat a completed draft claim as an open future commitment", () => {
    const analysis = analyseConversation(
      baseInput({
        messages: [{ ...sent, body: "I've prepared a draft quotation." }],
      })
    );
    assert.equal(analysis.proposals.some((item) => item.title === "Open commitment"), false);
    const quote = analysis.proposals.find((item) => item.semanticKey.startsWith("quote:"));
    assert.ok(quote);
    assert.match(quote.explanation, /no linked quotation was found/i);
    assert.doesNotMatch(quote.explanation, /Nothing was created/);
  });

  it("keeps an undated promise to prepare a draft on the quotation, not as a vague commitment", () => {
    const analysis = analyseConversation(
      baseInput({
        messages: [{ ...sent, body: "I'll prepare a draft." }],
      })
    );
    assert.equal(analysis.proposals.some((item) => item.actionType === "open_commitment"), false);
    assert.ok(analysis.proposals.some((item) => item.semanticKey.startsWith("quote:")));
  });

  it("keeps a requested team review separate from a completed draft claim", () => {
    const analysis = analyseConversation(
      baseInput({
        messages: [{ ...sent, body: "I've prepared a draft quotation. I'd like our team to review this." }],
      })
    );
    const review = analysis.proposals.find((item) => item.title === "Technical review requested");
    const quote = analysis.proposals.find((item) => item.semanticKey.startsWith("quote:"));
    assert.ok(review);
    assert.ok(quote);
    assert.notEqual(review.semanticKey, quote.semanticKey);
    assert.equal(review.evidenceMessageIds[0], "out-1");
    assert.doesNotMatch(review.explanation, /I've prepared/i);
  });

  it("links one relevant saved draft and does not ask to recreate it", () => {
    const analysis = analyseConversation(
      baseInput({
        existingQuotes: [{ id: "quote-1", status: "draft", fingerprint: "fp-1", dealId: "deal-1" }],
        messages: [{ ...sent, body: "I've prepared a draft quotation." }],
      })
    );
    const quote = analysis.proposals.find((item) => item.actionType === "quotation_draft");
    assert.ok(quote);
    assert.equal(quote.payload.quotationId, "quote-1");
    assert.equal(quote.payload.existing, true);
    assert.deepEqual(quote.missing, []);
    assert.doesNotMatch(quote.explanation, /Nothing was created|no linked quotation/i);
  });

  it("does not link a single quotation from a different opportunity", () => {
    const quotes = [
      { id: "quote-other", status: "draft", fingerprint: "fp", dealId: "deal-other" },
    ];
    assert.deepEqual(relevantQuotations(quotes, "deal-this"), []);
    assert.equal(relevantQuotations(quotes, null)[0]?.id, "quote-other");
    const analysis = analyseConversation(
      baseInput({
        existingQuotes: [],
        messages: [{ ...sent, body: "I've prepared a draft quotation." }],
      })
    );
    assert.match(analysis.proposals.find((item) => item.semanticKey.startsWith("quote:"))?.explanation ?? "", /no linked quotation was found/i);
  });

  it("shows the saved quotation status instead of claiming nothing was created", () => {
    const analysis = analyseConversation(
      baseInput({
        existingQuotes: [{ id: "quote-sent", status: "sent", fingerprint: "fp", dealId: "deal-1" }],
        messages: [{ ...sent, body: "I've prepared a draft quotation." }],
      })
    );
    const quote = analysis.proposals.find((item) => item.payload.quotationId === "quote-sent");
    assert.ok(quote);
    assert.match(quote.title, /sent/i);
    assert.doesNotMatch(quote.explanation, /Nothing was created|no linked quotation/i);
  });

  it("asks for a choice when more than one draft could match", () => {
    const analysis = analyseConversation(
      baseInput({
        existingQuotes: [
          { id: "quote-1", status: "draft", fingerprint: "a", dealId: "deal-1" },
          { id: "quote-2", status: "draft", fingerprint: "b", dealId: "deal-1" },
        ],
        messages: [{ ...customer, body: "Please send the quotation." }],
      })
    );
    const choice = analysis.proposals.find((item) => item.actionType === "quotation_choice");
    assert.ok(choice);
    assert.equal(Array.isArray(choice.payload.options) && choice.payload.options.length, 2);
  });

  it("treats a home system request as the main requirement and leaves technical fields unknown", () => {
    const analysis = analyseConversation(
      baseInput({
        requiredFields: [
          { key: "requirement", label: "Main requirement" },
          { key: "budget", label: "Budget" },
          { key: "roof", label: "Roof type" },
        ],
        knownFacts: {},
        catalogue: [],
        messages: [{ ...customer, body: "I need a solar system at home. Please prepare a quotation." }],
      })
    );
    const quote = analysis.proposals.find((item) => item.actionType === "quotation_missing");
    assert.ok(quote);
    assert.equal(quote.title, "Quotation needs more information");
    assert.equal(quote.missing.includes("Main requirement"), false);
    assert.equal(quote.missing.includes("Budget"), true);
    assert.equal(quote.missing.includes("Roof type"), true);
    assert.equal(quote.explanation.includes("Still needed"), false);
    assert.equal(analysis.summary.startsWith("Need:"), false);
  });

  it("reads a short approval with the preceding proposal", () => {
    const analysis = analyseConversation(
      baseInput({
        requiredFields: [
          { key: "requirement", label: "Main requirement" },
          { key: "budget", label: "Budget" },
        ],
        knownFacts: {},
        catalogue: [],
        messages: [
          { ...sent, id: "out-2", body: "I can include a 5kW home system in the quotation." },
          { ...customer, id: "in-2", createdAt: "2026-10-08T15:00:00.000Z", body: "Please go ahead" },
        ],
      })
    );
    const requirement = analysis.facts.find((fact) => fact.key === "requirement");
    assert.ok(requirement);
    assert.match(requirement.value, /5kW home system/);
    assert.equal(requirement.messageId, "out-2");
    assert.equal(analysis.facts.some((fact) => fact.key === "budget"), false);
  });

  it("uses different required questions for tyre sales and real estate", () => {
    const tyreFields = defaultRequiredFields({ businessType: "trades", hasListings: false, hasProducts: true });
    const estateFields = defaultRequiredFields({ businessType: "real_estate", hasListings: true, hasProducts: false });
    const ask = [{ ...customer, body: "Can I get a quotation?" }];
    const tyre = analyseConversation(baseInput({ requiredFields: tyreFields, knownFacts: {}, catalogue: [], messages: ask }));
    const estate = analyseConversation(
      baseInput({
        requiredFields: estateFields,
        knownFacts: {},
        catalogue: [],
        capabilities: { quotations: true, listings: true, appointments: true, reminders: true, stock: false },
        messages: ask,
      })
    );
    const tyreMissing = tyre.proposals.find((item) => item.actionType === "quotation_missing")?.missing ?? [];
    const estateMissing = estate.proposals.find((item) => item.actionType === "quotation_missing")?.missing ?? [];
    assert.deepEqual(tyreMissing, ["Product", "Quantity"]);
    assert.deepEqual(estateMissing, ["Sale or rental", "Location", "Budget"]);
  });

  it("revises the quotation item when a later analysis finds the saved draft", () => {
    const messages = [{ ...sent, body: "I've prepared a draft quotation." }];
    const before = analyseConversation(baseInput({ messages }));
    const after = analyseConversation(
      baseInput({
        messages,
        existingQuotes: [{ id: "quote-9", status: "draft", fingerprint: "fp", dealId: "deal-9" }],
      })
    );
    const previous = before.proposals.find((item) => item.semanticKey === "quote:incomplete");
    const next = after.proposals.find((item) => item.payload.quotationId === "quote-9");
    assert.ok(previous);
    assert.ok(next);
    const result = reconcileProposals({
      proposals: after.proposals,
      existing: [
        {
          id: "item-quote",
          semanticKey: previous.semanticKey,
          payloadHash: "old",
          reviewStatus: "pending",
          executionStatus: "none",
          fulfilmentStatus: "open",
          contextRevision: "rev1",
          evidenceMessageIds: ["out-1"],
          salespersonChoice: false,
          chosenId: null,
        },
      ],
      fulfilledKeys: after.fulfilledKeys,
      contextRevision: "rev2",
      loadedMessageIds: ["out-1"],
    });
    assert.equal(result.obsoleteIds.includes("item-quote"), true);
    assert.equal(result.upserts.some((item) => item.semanticKey === next.semanticKey), true);
    assert.equal(result.upserts.filter((item) => item.semanticKey.startsWith("quote:")).length, 1);
  });

  it("does not bring back a dismissed quotation suggestion with the same payload", () => {
    const analysis = analyseConversation(
      baseInput({ messages: [{ ...sent, body: "I've prepared a draft quotation." }] })
    );
    const proposal = analysis.proposals.find((item) => item.semanticKey === "quote:incomplete");
    assert.ok(proposal);
    const hash = payloadHash({
      actionType: proposal.actionType,
      proposedAt: proposal.proposedAt,
      payload: proposal.payload,
      missing: proposal.missing,
    });
    const result = reconcileProposals({
      proposals: [proposal],
      existing: [
        {
          id: "item-dismissed",
          semanticKey: proposal.semanticKey,
          payloadHash: hash,
          reviewStatus: "dismissed",
          executionStatus: "none",
          fulfilmentStatus: "open",
          contextRevision: "rev1",
          evidenceMessageIds: ["out-1"],
          salespersonChoice: false,
          chosenId: null,
        },
      ],
      fulfilledKeys: [],
      contextRevision: "rev2",
      loadedMessageIds: ["out-1"],
    });
    assert.equal(result.upserts.length, 0);
    assert.equal(result.obsoleteIds.includes("item-dismissed"), false);
  });

  it("labels the quotation actions specifically", () => {
    const source = readFileSync(new URL("../lib/sales-copilot/store.ts", import.meta.url), "utf8");
    assert.match(source, /quotation_missing"\) return "Add missing details"/);
    assert.match(source, /quotation_draft"\) return "Review draft"/);
    assert.match(source, /return "Set follow-up"/);
    assert.match(source, /answer_question"\) return "Draft reply"/);
  });

  it("keeps the review sheet from repeating the message in the header or snooze field", () => {
    const ui = readFileSync(new URL("../components/inbox/SalesCopilotWorkspace.tsx", import.meta.url), "utf8");
    assert.match(ui, /to review/);
    assert.match(ui, /View supporting messages/);
    assert.match(ui, /Confirm snooze/);
    assert.doesNotMatch(ui, /Still needed:/);
    assert.doesNotMatch(ui, /readableCopilotSummary\(summary\)/);
  });
});

describe("Sales Copilot quiet observation", () => {
  const customer = {
    id: "in-1",
    direction: "inbound" as const,
    createdAt: "2026-10-10T21:59:00.000Z",
    status: "received",
    authorId: null,
    authorName: "Customer",
  };
  const salesperson = {
    id: "out-1",
    direction: "outbound" as const,
    createdAt: "2026-10-10T22:25:00.000Z",
    status: "sent",
    authorId: "rep",
    authorName: "Ada",
  };

  it("keeps a future customer promise quiet until it is due or accepted", () => {
    const analysis = analyseConversation(
      baseInput({
        followUpAt: null,
        messages: [
          {
            id: "c-future",
            direction: "inbound",
            body: "I'll get back to you tomorrow.",
            createdAt: "2026-12-01T14:00:00.000Z",
            status: "received",
            authorId: null,
            authorName: "Customer",
          },
        ],
      })
    );
    const checkin = analysis.proposals.find((item) => item.actionType === "customer_checkin");
    assert.ok(checkin);
    assert.equal(checkin.waitingActor, "customer");
    assert.equal(checkin.payload.onDemand, true);
    assert.equal(analysis.proposals.some((item) => item.actionType === "create_reminder"), false);
  });

  it("keeps a meeting request quiet until the salesperson offers a time", () => {
    const analysis = analyseConversation(
      baseInput({
        followUpAt: null,
        messages: [{ ...customer, body: "Can we schedule a meeting tomorrow for that product?" }],
      })
    );
    assert.equal(analysis.proposals.some((item) => item.actionType === "create_reminder"), false);
    const noted = analysis.proposals.find((item) => item.semanticKey.startsWith("meeting:request"));
    assert.equal(noted?.payload.onDemand, true);
  });

  it("keeps the requested day when the reply crosses midnight", () => {
    const analysis = analyseConversation(
      baseInput({
        followUpAt: null,
        messages: [
          { ...customer, body: "Can we schedule a meeting tomorrow for that product?" },
          { ...salesperson, body: "Okay, 8am will be fine." },
        ],
      })
    );
    const meeting = analysis.proposals.find((item) => item.semanticKey === "meeting:2026-10-11");
    assert.ok(meeting);
    assert.equal(meeting.payload.onDemand, false);
    assert.equal(meeting.title, "Save a meeting reminder?");
    assert.equal(existingLocalDay(String(meeting.payload.followUpAt), TZ), "2026-10-11");
    assert.match(String(meeting.explanation), /08:00/);
    assert.match(meeting.explanation, /Awaiting customer confirmation/);
    assert.equal(meeting.payload.awaitingCustomerConfirmation, true);
  });

  it("updates the same meeting when the customer accepts", () => {
    const analysis = analyseConversation(
      baseInput({
        followUpAt: null,
        messages: [
          { ...customer, body: "Can we schedule a meeting tomorrow for that product?" },
          { ...salesperson, body: "Okay, 8am will be fine." },
          {
            ...customer,
            id: "in-2",
            createdAt: "2026-10-10T22:40:00.000Z",
            body: "Yes",
          },
        ],
      })
    );
    const meetings = analysis.proposals.filter((item) => item.semanticKey.startsWith("meeting:"));
    assert.equal(meetings.length, 1);
    assert.equal(meetings[0].payload.awaitingCustomerConfirmation, false);
    assert.match(meetings[0].explanation, /accepted/i);
  });

  it("offers quotation help after the salesperson commits, not after the request alone", () => {
    const asked = analyseConversation(
      baseInput({
        messages: [{ ...customer, id: "q", createdAt: "2026-10-08T14:00:00.000Z", body: "Can you send a quotation?" }],
      })
    );
    const quiet = asked.proposals.find((item) => String(item.actionType).startsWith("quotation"));
    assert.equal(quiet?.payload.onDemand, true);
    const offered = analyseConversation(
      baseInput({
        knownFacts: { size: "205/55R16", brand: "Michelin", quantity: "4", branch: "Harare" },
        messages: [
          { ...customer, id: "q", createdAt: "2026-10-08T14:00:00.000Z", body: "Please quote 4 Michelin Pilot 205/55R16 tyres." },
          { ...salesperson, id: "s", createdAt: "2026-10-08T15:00:00.000Z", body: "Let me prepare a quotation." },
        ],
      })
    );
    const draft = offered.proposals.find((item) => item.actionType === "quotation_draft");
    assert.ok(draft);
    assert.notEqual(draft.payload.onDemand, true);
    assert.match(draft.explanation, /prepare a draft quotation for your review/i);
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
