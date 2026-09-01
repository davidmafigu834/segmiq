/**
 * Phase 17 — Avatars, Identity & Status
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getInitials } from "@/lib/ui/initials";
import { derivePresenceState } from "@/lib/presence/derive-presence";
import { PRESENCE_ONLINE_MS, PRESENCE_AWAY_MS } from "@/lib/presence/constants";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("sales identity Phase 17", () => {
  it("generates predictable initials", () => {
    assert.equal(getInitials("Tafadzwa Moyo"), "TM");
    assert.equal(getInitials("Chiedza"), "C");
    assert.equal(getInitials("  Solar   Bright  Pvt Ltd "), "SL");
    assert.equal(getInitials(""), "?");
  });

  it("lead score boundaries follow 70/45 rule", () => {
    const badge = read("components/sales/ui/Badge.tsx");
    assert.ok(badge.includes("score >= 70"));
    assert.ok(badge.includes("score >= 45"));
    assert.ok(badge.includes("info"));
    assert.ok(!badge.includes("Very Cold"));
  });

  it("derives presence from lastSeenAt thresholds", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    const recent = new Date(now.getTime() - 30_000).toISOString();
    const away = new Date(now.getTime() - PRESENCE_ONLINE_MS - 60_000).toISOString();
    const offline = new Date(now.getTime() - PRESENCE_AWAY_MS - 60_000).toISOString();

    assert.equal(derivePresenceState({ lastSeenAt: recent, now }), "online");
    assert.equal(derivePresenceState({ lastSeenAt: away, now }), "away");
    assert.equal(derivePresenceState({ lastSeenAt: offline, now }), "offline");
    assert.equal(
      derivePresenceState({ lastSeenAt: recent, availabilityOverride: "BUSY", now }),
      "busy"
    );
    assert.equal(
      derivePresenceState({ lastSeenAt: recent, availabilityOverride: "AWAY", now }),
      "away"
    );
  });

  it("Avatar uses Lucide fallback and image error handling", () => {
    const avatar = read("components/sales/ui/Avatar.tsx");
    assert.ok(avatar.includes("UserRound"));
    assert.ok(avatar.includes("onError"));
    assert.ok(avatar.includes("getInitials"));
    assert.ok(!avatar.includes("📞"));
  });

  it("presence heartbeat API uses authenticated user only", () => {
    const route = read("app/api/users/me/presence/route.ts");
    assert.ok(route.includes("getAuthFromRequest"));
    assert.ok(route.includes("last_seen_at"));
    assert.ok(route.includes("derivePresenceState"));
    assert.ok(!route.includes("userId from body"));
  });

  it("legacy ScoreBadge delegates to LeadScoreBadge", () => {
    const legacy = read("components/ui/ScoreBadge.tsx");
    assert.ok(legacy.includes("LeadScoreBadge"));
  });

  it("migration adds user presence columns", () => {
    const sql = read("supabase/migrations/20260901170000_user_presence_phase17.sql");
    assert.ok(sql.includes("last_seen_at"));
    assert.ok(sql.includes("availability_override"));
  });
});
