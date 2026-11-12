import test from "node:test";
import assert from "node:assert/strict";
import { sidebarDangerNote } from "../lib/real-estate/sidebar-note";

test("an overdue workspace replaces the tip with the payment card", () => {
  const note = sidebarDangerNote({ overdue: true, attention: 0, homeHref: "/client/dashboard" });
  assert.equal(note?.body, "This workspace payment is overdue.");
  assert.equal(note?.href, "/client/billing");
  assert.equal(sidebarDangerNote({ overdue: false, attention: 0, homeHref: "/client/dashboard" }), null);
});

test("an agent sees the overdue fact without a billing page they cannot open", () => {
  const note = sidebarDangerNote({ overdue: true, attention: 4, homeHref: "/sales/dashboard" });
  assert.match(note?.body ?? "", /manager settles billing/);
  assert.equal(note?.href, null);
});

test("other attention still uses the follow-up card when the workspace is current", () => {
  const manager = sidebarDangerNote({ overdue: false, attention: 1, homeHref: "/client/dashboard" });
  assert.equal(manager?.body, "A message is waiting for a reply.");
  assert.equal(manager?.href, "/client/dashboard");
  const agent = sidebarDangerNote({ overdue: false, attention: 1, homeHref: "/sales/dashboard" });
  assert.equal(agent?.body, "A viewing follow-up was due yesterday.");
});
