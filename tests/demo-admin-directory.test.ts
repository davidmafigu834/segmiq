import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guestAccessMessage, invitationStatus } from "../lib/demo/admin-directory";

describe("demo invitation directory", () => {
  const now = Date.parse("2026-10-15T12:00:00.000Z");

  it("marks revoked invitations ahead of expiry", () => {
    assert.equal(
      invitationStatus({ revokedAt: "2026-10-15T11:00:00.000Z", expiresAt: "2026-10-20T12:00:00.000Z" }, now),
      "revoked"
    );
  });

  it("marks an unrevoked future invitation active", () => {
    assert.equal(invitationStatus({ revokedAt: null, expiresAt: "2026-10-16T12:00:00.000Z" }, now), "active");
  });

  it("marks a past invitation expired", () => {
    assert.equal(invitationStatus({ revokedAt: null, expiresAt: "2026-10-15T11:00:00.000Z" }, now), "expired");
  });

  it("explains a closed guest gate without inviting an isolated deployment", () => {
    const message = guestAccessMessage("shared-database-not-selected");
    assert.ok(message?.includes("shared demo database"));
    assert.equal(guestAccessMessage(null), null);
  });
});
