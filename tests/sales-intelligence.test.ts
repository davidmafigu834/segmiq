import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_PRIORITY_WEIGHTS, DEFAULT_STAGE_INACTIVITY_HOURS } from "@/lib/sales/intelligence/defaults";
import { deriveFocusMode } from "@/lib/sales/intelligence/focus-mode";
import { calcPipelineCoverage } from "@/lib/sales/intelligence/pipeline-coverage";
import {
  rankSalesActions,
  shouldResolveRecommendation,
} from "@/lib/sales/intelligence/priority-engine";
import { planDateInTimezone } from "@/lib/sales/intelligence/timezone";
import { isValidProspectingLead } from "@/lib/sales/intelligence/valid-prospect";
import type { LeadIntelligenceSignal, PriorityEngineContext } from "@/lib/sales/intelligence/types";

function ctx(partial?: Partial<PriorityEngineContext>): PriorityEngineContext {
  return {
    now: new Date("2026-08-11T10:00:00.000Z"),
    salespersonId: "sp-1",
    planDate: "2026-08-11",
    remainingGoalValue: 20000,
    activePipelineValue: 8000,
    hasConfiguredProspectTarget: true,
    prospectTarget: 10,
    prospectsCompletedToday: 0,
    stageInactivityHours: { ...DEFAULT_STAGE_INACTIVITY_HOURS },
    quoteFollowupHours: 72,
    weights: { ...DEFAULT_PRIORITY_WEIGHTS },
    ...partial,
  };
}

function lead(partial: Partial<LeadIntelligenceSignal> & Pick<LeadIntelligenceSignal, "id" | "name">): LeadIntelligenceSignal {
  return {
    phone: "+263771234567",
    email: null,
    source: "MANUAL",
    status: "CONTACTED",
    score: 50,
    manualPriority: null,
    projectType: null,
    dealValue: null,
    budget: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    followUpDate: null,
    callbackAt: null,
    assignedToId: "sp-1",
    followUpCreatedById: null,
    firstRespondedAt: "2026-08-01T12:00:00.000Z",
    lastMeaningfulActivityAt: "2026-08-01T12:00:00.000Z",
    awaitingReplyMinutes: null,
    hasFutureNextAction: false,
    openQuote: null,
    isWhatsAppCapable: true,
    ...partial,
  };
}

describe("priority engine ranking", () => {
  it("puts uncontacted inbound enquiries in newEnquiries lane, not Today's Focus queue", () => {
    const hot = lead({
      id: "hot-1",
      name: "Tafadzwa Moyo",
      source: "FACEBOOK",
      status: "NEW",
      score: 92,
      createdAt: "2026-08-11T09:55:00.000Z",
      firstRespondedAt: null,
      lastMeaningfulActivityAt: null,
      awaitingReplyMinutes: 5,
    });
    const ranked = rankSalesActions({ leads: [hot], ctx: ctx() });
    assert.equal(ranked.newEnquiries[0]?.actionType, "CONTACT_NEW_LEAD");
    assert.equal(ranked.newEnquiries[0]?.metadata?.focusLane, "new_enquiry");
    assert.ok(!ranked.queue.some((q) => q.actionType === "CONTACT_NEW_LEAD"));
    assert.ok(!ranked.queue.some((q) => q.reasonCode === "CUSTOMER_WAITING"));
  });

  it("does not treat brand-new unread as CUSTOMER_WAITING without a sales thread", () => {
    const unread = lead({
      id: "unread-1",
      name: "New Chat",
      source: "WHATSAPP_INBOUND",
      status: "NEW",
      score: 40,
      createdAt: "2026-08-11T09:00:00.000Z",
      firstRespondedAt: null,
      dealId: null,
      openQuote: null,
      followUpDate: null,
      callbackAt: null,
      hasFutureNextAction: false,
      awaitingReplyMinutes: 40,
    });
    const ranked = rankSalesActions({ leads: [unread], ctx: ctx() });
    assert.ok(!ranked.all.some((a) => a.reasonCode === "CUSTOMER_WAITING"));
    assert.ok(ranked.newEnquiries.some((a) => a.sourceEntityId === "unread-1"));
  });

  it("ranks mid-thread customer waiting in Today's Focus queue", () => {
    const waiting = lead({
      id: "wait-1",
      name: "Sarah",
      status: "NEGOTIATING",
      score: 60,
      awaitingReplyMinutes: 28,
      firstRespondedAt: "2026-08-10T10:00:00.000Z",
      lastMeaningfulActivityAt: "2026-08-11T09:30:00.000Z",
    });
    const stale = lead({
      id: "stale-1",
      name: "Old Deal",
      status: "CONTACTED",
      score: 40,
      createdAt: "2026-07-01T10:00:00.000Z",
      lastMeaningfulActivityAt: "2026-07-01T10:00:00.000Z",
    });
    const ranked = rankSalesActions({ leads: [stale, waiting], ctx: ctx() });
    assert.equal(ranked.nextBestAction?.actionType, "RESPOND_TO_CUSTOMER");
    assert.equal(ranked.nextBestAction?.reasonCode, "CUSTOMER_WAITING");
  });

  it("ranks overdue follow-up highly", () => {
    const overdue = lead({
      id: "fu-1",
      name: "Samson",
      followUpDate: "2026-08-10T10:00:00.000Z",
      score: 55,
      status: "CONTACTED",
      lastMeaningfulActivityAt: "2026-08-10T09:00:00.000Z",
      hasFutureNextAction: true,
    });
    const ranked = rankSalesActions({ leads: [overdue], ctx: ctx() });
    assert.equal(ranked.nextBestAction?.reasonCode, "FOLLOWUP_OVERDUE");
    assert.ok((ranked.nextBestAction?.attentionScore ?? 0) >= 50);
  });

  it("produces REENGAGE_STALE_DEAL for inactive negotiating deals", () => {
    const stale = lead({
      id: "neg-1",
      name: "Chiedza Ndlovu",
      status: "NEGOTIATING",
      score: 65,
      createdAt: "2026-07-01T10:00:00.000Z",
      firstRespondedAt: "2026-07-02T10:00:00.000Z",
      lastMeaningfulActivityAt: "2026-07-20T10:00:00.000Z",
      hasFutureNextAction: true, // has a far-future action conceptually, but we still flag inactivity
      followUpDate: "2026-09-01T10:00:00.000Z",
    });
    // Force stale by clearing future action and follow-up so stale path wins cleanly
    stale.hasFutureNextAction = false;
    stale.followUpDate = null;
    const ranked = rankSalesActions({
      leads: [stale],
      ctx: ctx({
        stageInactivityHours: { ...DEFAULT_STAGE_INACTIVITY_HOURS, NEGOTIATING: 48 },
      }),
    });
    const hit = ranked.all.find(
      (a) =>
        a.actionType === "REENGAGE_STALE_DEAL" ||
        a.reasonCode === "DEAL_STALE" ||
        a.reasonCode === "LATE_STAGE_NEEDS_ACTION" ||
        a.reasonCode === "NO_NEXT_ACTION"
    );
    assert.ok(hit, "expected stale or no-next-action recommendation for inactive negotiating deal");
  });

  it("ranks active Deal signals with deal sourceEntityType", () => {
    const dealSignal = lead({
      id: "origin-lead-1",
      name: "Warehouse Roofing",
      status: "NEGOTIATING",
      score: 70,
      firstRespondedAt: "2026-08-01T12:00:00.000Z",
      lastMeaningfulActivityAt: "2026-08-10T12:00:00.000Z",
      hasFutureNextAction: false,
      followUpDate: null,
      dealId: "deal-99",
    });
    const ranked = rankSalesActions({ leads: [dealSignal], ctx: ctx() });
    const hit = ranked.queue.find((q) => q.sourceEntityType === "deal") ?? ranked.all.find((q) => q.sourceEntityType === "deal");
    assert.ok(hit, "expected deal-typed recommendation");
    assert.equal(hit!.sourceEntityId, "deal-99");
    assert.equal(hit!.metadata.dealId, "deal-99");
    assert.equal(hit!.customer?.leadId, "origin-lead-1");
  });

  it("produces PROSPECT_NEW_CUSTOMERS when deal queue empty and coverage low", () => {
    const ranked = rankSalesActions({
      leads: [],
      ctx: ctx({ remainingGoalValue: 20000, activePipelineValue: 5000 }),
    });
    assert.equal(ranked.nextBestAction?.actionType, "PROSPECT_NEW_CUSTOMERS");
  });

  it("keeps new hot inbound in newEnquiries lane (does not displace focus queue)", () => {
    const hot = lead({
      id: "hot-2",
      name: "Tariro",
      source: "FACEBOOK",
      status: "NEW",
      score: 90,
      createdAt: "2026-08-11T09:54:00.000Z",
      firstRespondedAt: null,
      lastMeaningfulActivityAt: null,
      awaitingReplyMinutes: 6,
    });
    const ranked = rankSalesActions({
      leads: [hot],
      ctx: ctx({ prospectsCompletedToday: 6, prospectTarget: 10 }),
    });
    assert.equal(ranked.newEnquiries[0]?.actionType, "CONTACT_NEW_LEAD");
    assert.ok(!ranked.queue.some((q) => q.actionType === "CONTACT_NEW_LEAD"));
    // With no mid-thread sales work, prospecting may still fill Today's Focus.
    assert.equal(ranked.nextBestAction?.actionType, "PROSPECT_NEW_CUSTOMERS");
  });
});

describe("recommendation resolution", () => {
  it("resolves customer waiting after reply", () => {
    const before = lead({
      id: "w1",
      name: "Sarah",
      awaitingReplyMinutes: 20,
    });
    assert.equal(
      shouldResolveRecommendation(
        { actionType: "RESPOND_TO_CUSTOMER", reasonCode: "CUSTOMER_WAITING", sourceEntityId: "w1" },
        { ...before, awaitingReplyMinutes: null }
      ),
      true
    );
  });

  it("resolves no-next-action when follow-up scheduled", () => {
    const leadRow = lead({
      id: "n1",
      name: "Deal",
      followUpDate: "2026-08-12T10:00:00.000Z",
      hasFutureNextAction: true,
    });
    assert.equal(
      shouldResolveRecommendation(
        { actionType: "SCHEDULE_NEXT_ACTION", reasonCode: "NO_NEXT_ACTION", sourceEntityId: "n1" },
        leadRow
      ),
      true
    );
  });
});

describe("valid prospect counting", () => {
  it("counts valid unique outbound prospect", () => {
    const r = isValidProspectingLead(
      {
        id: "p1",
        name: "Nyasha P",
        phone: "+263771111111",
        email: null,
        source: "MANUAL",
        assignedToId: "sp-1",
        createdAt: "2026-08-11T08:00:00.000Z",
        hasOutreachActivity: true,
        isDuplicate: false,
      },
      { salespersonId: "sp-1" }
    );
    assert.equal(r.valid, true);
  });

  it("rejects duplicate, missing contact, and inbound facebook", () => {
    assert.equal(
      isValidProspectingLead(
        {
          id: "p2",
          name: "Dup",
          phone: "+263771111111",
          email: null,
          source: "MANUAL",
          assignedToId: "sp-1",
          createdAt: "2026-08-11T08:00:00.000Z",
          hasOutreachActivity: true,
          isDuplicate: true,
        },
        { salespersonId: "sp-1" }
      ).valid,
      false
    );
    assert.equal(
      isValidProspectingLead(
        {
          id: "p3",
          name: "No Contact",
          phone: null,
          email: null,
          source: "MANUAL",
          assignedToId: "sp-1",
          createdAt: "2026-08-11T08:00:00.000Z",
          hasOutreachActivity: true,
        },
        { salespersonId: "sp-1" }
      ).valid,
      false
    );
    assert.equal(
      isValidProspectingLead(
        {
          id: "p4",
          name: "FB Lead",
          phone: "+263772222222",
          email: null,
          source: "FACEBOOK",
          assignedToId: "sp-1",
          createdAt: "2026-08-11T08:00:00.000Z",
          hasOutreachActivity: true,
        },
        { salespersonId: "sp-1" }
      ).reason,
      "inbound_source"
    );
  });
});

describe("pipeline coverage", () => {
  it("computes 2x coverage", () => {
    const c = calcPipelineCoverage({
      remainingGoalValue: 20000,
      activePipelineValue: 40000,
      hasReliablePipelineValues: true,
    });
    assert.equal(c.coverageRatio, 2);
    assert.equal(c.available, true);
  });

  it("handles remaining 0 without divide by zero", () => {
    const c = calcPipelineCoverage({
      remainingGoalValue: 0,
      activePipelineValue: 10000,
      hasReliablePipelineValues: true,
    });
    assert.equal(c.coverageRatio, null);
    assert.match(c.coverageLabel, /Goal achieved/i);
  });

  it("returns unavailable when values missing", () => {
    const c = calcPipelineCoverage({
      remainingGoalValue: 20000,
      activePipelineValue: null,
      hasReliablePipelineValues: false,
    });
    assert.equal(c.available, false);
    assert.equal(c.coverageRatio, null);
  });
});

describe("timezone day boundaries", () => {
  it("formats plan date in Africa/Harare around UTC midnight", () => {
    // 2026-08-10 22:30 UTC = 2026-08-11 00:30 in Harare (UTC+2)
    const d = new Date("2026-08-10T22:30:00.000Z");
    assert.equal(planDateInTimezone(d, "Africa/Harare"), "2026-08-11");
    // just before Harare midnight
    const before = new Date("2026-08-10T21:30:00.000Z");
    assert.equal(planDateInTimezone(before, "Africa/Harare"), "2026-08-10");
  });
});

describe("focus mode", () => {
  it("selects BUILD when no deal actions and coverage low", () => {
    const coverage = calcPipelineCoverage({
      remainingGoalValue: 20000,
      activePipelineValue: 5000,
      hasReliablePipelineValues: true,
    });
    const focus = deriveFocusMode({
      priorityActions: [],
      coverage,
      lateStageCount: 0,
      activeDealCount: 1,
    });
    assert.equal(focus.mode, "BUILD");
  });
});
