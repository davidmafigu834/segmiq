import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchQuickIntent } from "../lib/agent/manager/intents";
import {
  buildOvernightSummaryLine,
  resolveOvernightWindow,
} from "../lib/agent/real-estate/overnight-summary";
import { evaluateRealEstateToolPolicy, RE_AGENT_TOOL_NAMES } from "../lib/agent/real-estate/policy";
import { REAL_ESTATE_AGENT_SETTINGS_DEFAULTS } from "../lib/agent/real-estate/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("overnight window", () => {
  it("uses overnight label before noon", () => {
    const window = resolveOvernightWindow(new Date("2026-08-31T08:00:00"));
    assert.equal(window.label, "Overnight");
    assert.ok(window.since < window.until);
  });

  it("uses today label after noon", () => {
    const window = resolveOvernightWindow(new Date("2026-08-31T14:00:00"));
    assert.equal(window.label, "Today");
  });
});

describe("overnight summary line", () => {
  it("summarises handled conversations and viewing approvals", () => {
    const line = buildOvernightSummaryLine({
      windowLabel: "Overnight",
      executionsCompleted: 8,
      repliesSent: 6,
      viewingApprovalsPending: 2,
      humanHandoffs: 1,
    });
    assert.match(line, /8 conversations handled/);
    assert.match(line, /6 repl/);
    assert.match(line, /2 viewing approvals waiting/);
  });

  it("handles quiet windows", () => {
    const line = buildOvernightSummaryLine({
      windowLabel: "Overnight",
      executionsCompleted: 0,
      repliesSent: 0,
      viewingApprovalsPending: 0,
      humanHandoffs: 0,
    });
    assert.match(line, /no new activity/i);
  });
});

describe("manager intents phase 5", () => {
  it("routes overnight agent questions", () => {
    assert.equal(matchQuickIntent("What did SegmiQ Agent do overnight?"), "OVERNIGHT_AGENT");
    assert.equal(matchQuickIntent("What did agent handle overnight?"), "AGENT_ACTIVITY");
  });

  it("routes viewing approval questions", () => {
    assert.equal(matchQuickIntent("Show viewing approvals waiting"), "VIEWING_APPROVALS");
  });
});

describe("RE agent security policy", () => {
  it("blocks all RE tools when settings missing", () => {
    for (const tool of RE_AGENT_TOOL_NAMES) {
      const decision = evaluateRealEstateToolPolicy(tool, undefined);
      assert.equal(decision.allowed, false);
    }
  });

  it("blocks viewing.schedule when confirm viewings disabled", () => {
    const settings = { ...REAL_ESTATE_AGENT_SETTINGS_DEFAULTS, allowConfirmViewings: false };
    assert.equal(evaluateRealEstateToolPolicy("viewing.schedule", settings).allowed, false);
    assert.equal(evaluateRealEstateToolPolicy("viewing.request_approval", settings).allowed, true);
  });

  it("blocks property.match when search disabled", () => {
    const settings = { ...REAL_ESTATE_AGENT_SETTINGS_DEFAULTS, allowPropertySearch: false };
    assert.equal(evaluateRealEstateToolPolicy("property.match", settings).allowed, false);
  });
});

describe("manager API tenant guards", () => {
  it("scopes manager dashboard route to manager roles and RE business type", () => {
    const route = read("app/api/agent/real-estate/manager-dashboard/route.ts");
    assert.ok(route.includes('auth.role !== "CLIENT_MANAGER"'));
    assert.ok(route.includes("isRealEstate"));
    assert.ok(route.includes("auth.clientId !== clientId"));
  });

  it("scopes agent activity route to client manager tenant", () => {
    const route = read("app/api/agent/activity/route.ts");
    assert.ok(route.includes('auth.role === "CLIENT_MANAGER"'));
    assert.ok(route.includes("requestedClient !== auth.clientId"));
  });
});

describe("command center agent activity routing", () => {
  it("maps AGENT_ACTIVITY to execution search not human-needed only", () => {
    const runtime = read("lib/agent/manager/runtime.ts");
    assert.ok(runtime.includes('AGENT_ACTIVITY: { name: "search_agent_executions"'));
    assert.ok(runtime.includes('OVERNIGHT_AGENT: { name: "get_overnight_agent_summary"'));
    assert.ok(runtime.includes("viewingApproval: true"));
  });
});
