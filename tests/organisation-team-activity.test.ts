import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrganisationTeamActivity } from "@/lib/agency/organisation-team-activity";

const now = new Date("2026-10-01T12:00:00.000Z");

function iso(msAgo: number) {
  return new Date(now.getTime() - msAgo).toISOString();
}

describe("organisation team activity", () => {
  it("orders by presence, then never seen, with disabled accounts last", () => {
    const activity = buildOrganisationTeamActivity({
      now,
      events: [],
      users: [
        {
          id: "disabled",
          name: "Disabled Online",
          role: "SALESPERSON",
          isActive: false,
          lastSeenAt: iso(30_000),
          availabilityOverride: null,
        },
        {
          id: "never",
          name: "Never Seen",
          role: "SALESPERSON",
          isActive: true,
          lastSeenAt: null,
          availabilityOverride: null,
        },
        {
          id: "offline",
          name: "Offline Rep",
          role: "SALESPERSON",
          isActive: true,
          lastSeenAt: iso(60 * 60 * 1000),
          availabilityOverride: null,
        },
        {
          id: "busy",
          name: "Busy Rep",
          role: "CLIENT_MANAGER",
          isActive: true,
          lastSeenAt: iso(20_000),
          availabilityOverride: "BUSY",
        },
        {
          id: "away",
          name: "Away Rep",
          role: "SALESPERSON",
          isActive: true,
          lastSeenAt: iso(5 * 60 * 1000),
          availabilityOverride: null,
        },
        {
          id: "online",
          name: "Online Rep",
          role: "SALESPERSON",
          isActive: true,
          lastSeenAt: iso(30_000),
          availabilityOverride: null,
        },
      ],
    });

    assert.deepEqual(
      activity.members.map((member) => member.id),
      ["online", "away", "busy", "offline", "never", "disabled"]
    );
    assert.equal(activity.members[0]?.presenceLabel, "Online");
    assert.equal(activity.members[0]?.lastOnlineLabel, "Online now");
    assert.equal(activity.members[4]?.lastOnlineLabel, "Never");
    assert.equal(activity.members[5]?.presenceLabel, "Disabled");
    assert.equal(activity.members[5]?.presence, "offline");
    assert.deepEqual(activity.summary, {
      online: 1,
      away: 1,
      busy: 1,
      offline: 2,
      disabled: 1,
    });
  });

  it("labels the newest lead or deal touch and omits customer record fields", () => {
    const activity = buildOrganisationTeamActivity({
      now,
      users: [
        {
          id: "ada",
          name: "Ada",
          role: "SALESPERSON",
          isActive: true,
          lastSeenAt: iso(30_000),
          availabilityOverride: null,
        },
        {
          id: "ben",
          name: "Ben",
          role: "CLIENT_MANAGER",
          isActive: true,
          lastSeenAt: null,
          availabilityOverride: null,
        },
      ],
      events: [
        {
          actorId: "ada",
          createdAt: iso(3 * 60 * 60 * 1000),
          dealId: null,
        },
        {
          actorId: "ada",
          createdAt: iso(2 * 60 * 60 * 1000),
          dealId: "deal-1",
        },
      ],
    });

    const ada = activity.members.find((member) => member.id === "ada");
    const ben = activity.members.find((member) => member.id === "ben");
    assert.equal(ada?.workLabel, "Deal · 2 hours ago");
    assert.equal(ben?.workLabel, "No recorded work");
    assert.equal(ada?.roleLabel, "Salesperson");
    assert.equal(ben?.roleLabel, "Manager");

    const serialized = JSON.stringify(activity);
    assert.equal(serialized.includes("deal-1"), false);
    assert.equal(serialized.includes("phone"), false);
    assert.equal(serialized.includes("leadName"), false);
    for (const member of activity.members) {
      assert.deepEqual(Object.keys(member).sort(), [
        "id",
        "isActive",
        "lastOnlineLabel",
        "lastSeenAt",
        "name",
        "presence",
        "presenceLabel",
        "role",
        "roleLabel",
        "workLabel",
      ]);
    }
  });
});
