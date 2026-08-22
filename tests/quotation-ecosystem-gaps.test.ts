import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { actorCanApproveTargets, awaitingApproverLabel } from "../lib/quotations/approver-authority";
import { humanReadablePolicy } from "../lib/quotations/approval-engine";
import { quotationEventsToChatMessages } from "../lib/quotations/hub-events";
import { canCreateDealRevision, classifyDealQuotations } from "../lib/sales/deals/current-quotation";

describe("approver authority", () => {
  it("lets a named approver decide and blocks other managers", () => {
    const targets = [{ approverUserId: "mgr-1", approverRole: "CLIENT_MANAGER" }];
    assert.equal(
      actorCanApproveTargets({ id: "mgr-1", role: "CLIENT_MANAGER" }, targets),
      true
    );
    assert.equal(
      actorCanApproveTargets({ id: "mgr-2", role: "CLIENT_MANAGER" }, targets),
      false
    );
    assert.equal(actorCanApproveTargets({ id: "admin", role: "SUPER_ADMIN" }, targets), true);
    assert.equal(actorCanApproveTargets({ id: "rep", role: "SALESPERSON" }, targets), false);
  });

  it("lets any sales manager approve role-only rules", () => {
    const targets = [{ approverRole: "CLIENT_MANAGER", approverUserId: null }];
    assert.equal(
      actorCanApproveTargets({ id: "mgr-2", role: "CLIENT_MANAGER" }, targets),
      true
    );
    assert.match(awaitingApproverLabel(targets), /authorised manager|Sales Manager/i);
  });
});

describe("approval policy preview", () => {
  it("writes a readable discount rule", () => {
    assert.equal(
      humanReadablePolicy({
        trigger_type: "discount",
        operator: "gt",
        threshold_numeric: 5,
        approver_role: "CLIENT_MANAGER",
      }),
      "Quotes with discount above 5% require Sales Manager approval."
    );
  });
});

describe("deal current offer", () => {
  it("keeps superseded versions out of current", () => {
    const { current, previous } = classifyDealQuotations([
      {
        id: "v1",
        quote_number: "QT-1",
        revision_number: 1,
        status: "superseded",
        total: 19400,
        currency: "USD",
        valid_until: null,
        sent_at: "2026-01-01",
        viewed_at: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        parent_quotation_id: null,
      },
      {
        id: "v2",
        quote_number: "QT-1",
        revision_number: 2,
        status: "sent",
        total: 18500,
        currency: "USD",
        valid_until: null,
        sent_at: "2026-01-08",
        viewed_at: null,
        created_at: "2026-01-08",
        updated_at: "2026-01-08",
        parent_quotation_id: "v1",
      },
    ]);
    assert.equal(current?.id, "v2");
    assert.equal(previous[0]?.id, "v1");
    assert.equal(canCreateDealRevision(current), true);
  });
});

describe("whatsapp hub quotation events", () => {
  it("maps canonical customer events and does not invent Deal Won", () => {
    const messages = quotationEventsToChatMessages(
      [
        {
          id: "e1",
          event_type: "SENT",
          event_data: { total: 18500, currency: "USD" },
          created_at: "2026-01-08T10:00:00.000Z",
          quotation_id: "q1",
        },
        {
          id: "e2",
          event_type: "ACCEPTED",
          event_data: { acceptedTotal: 19850, currency: "USD" },
          created_at: "2026-01-09T10:00:00.000Z",
          quotation_id: "q1",
        },
      ],
      {
        quotes: [{ id: "q1", quote_number: "QT-1", revision_number: 2, total: 18500, currency: "USD" }],
        role: "SALESPERSON",
      }
    );
    assert.equal(messages[0]?.systemTitle, "Quote sent");
    assert.equal(messages[0]?.href, "/sales/quotes/q1");
    assert.equal(messages[1]?.systemTitle, "Quotation accepted");
    assert.equal(messages.some((m) => /deal won/i.test(m.text + (m.systemTitle ?? ""))), false);
  });
});
