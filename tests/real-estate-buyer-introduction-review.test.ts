import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canReviewIntroduction,
  introductionEligibility,
  introductionNotifyUserIds,
  reviewerWaitingCopy,
} from "../lib/real-estate/buyer-introduction-review";

const activeSearch = { status: "active", pipelineStage: "actively_searching" };
const liveListing = { status: "available", approvalStatus: "approved" };

describe("introduction review routing", () => {
  it("notifies the current assignee and routes an unassigned buyer to managers", () => {
    assert.deepEqual(
      introductionNotifyUserIds({
        requesterId: "agent-a",
        currentAssigneeId: "agent-b",
        assigneeActive: true,
        activeManagerIds: ["manager-1"],
      }),
      ["agent-b"]
    );
    assert.deepEqual(
      introductionNotifyUserIds({
        requesterId: "agent-a",
        currentAssigneeId: null,
        assigneeActive: false,
        activeManagerIds: ["manager-1", "agent-a"],
      }),
      ["manager-1"]
    );
  });

  it("does not let a stale owner or the requester approve", () => {
    assert.equal(
      canReviewIntroduction({
        actorId: "agent-old",
        actorRole: "SALESPERSON",
        requesterId: "agent-a",
        currentAssigneeId: "agent-c",
        assigneeActive: true,
      }).ok,
      false
    );
    assert.equal(
      canReviewIntroduction({
        actorId: "manager-1",
        actorRole: "CLIENT_MANAGER",
        requesterId: "manager-1",
        currentAssigneeId: null,
        assigneeActive: false,
      }).ok,
      false
    );
    assert.equal(
      canReviewIntroduction({
        actorId: "manager-2",
        actorRole: "CLIENT_MANAGER",
        requesterId: "agent-a",
        currentAssigneeId: null,
        assigneeActive: false,
      }).ok,
      true
    );
    assert.equal(
      canReviewIntroduction({
        actorId: "agent-c",
        actorRole: "SALESPERSON",
        requesterId: "agent-a",
        currentAssigneeId: "agent-c",
        assigneeActive: true,
      }).ok,
      true
    );
  });

  it("refuses approval when the search or listing is no longer eligible", () => {
    assert.equal(introductionEligibility({ requesterActive: true, search: activeSearch, listing: liveListing }).eligible, true);
    const sold = introductionEligibility({
      requesterActive: true,
      search: activeSearch,
      listing: { status: "sold", approvalStatus: "approved" },
    });
    assert.equal(sold.eligible, false);
    const closed = introductionEligibility({
      requesterActive: true,
      search: { status: "closed", pipelineStage: "closed" },
      listing: liveListing,
    });
    assert.equal(closed.eligible, false);
    assert.equal(reviewerWaitingCopy({ assigneeName: null }), "Awaiting review by agency management.");
  });
});
