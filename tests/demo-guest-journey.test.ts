import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROSSI_ACTORS } from "../lib/demo/actors";
import { buildDemoCompanyDashboard } from "../lib/demo/adapters/workspace-views";
import { demoId } from "../lib/demo/ids";
import { buildRossiDataset } from "../lib/demo/industries/tyres/rossi/dataset";
import { invitationAccess } from "../lib/demo/invitation-access";
import { applyDemoMutations } from "../lib/demo/mutations";
import { findDemoPersona } from "../lib/demo/personas";
import {
  appendSessionMutationWithRepo,
  type SessionMutationRepo,
} from "../lib/demo/session-store";
import type { DemoMutation } from "../lib/demo/types";

const clientId = "rossi-client";
const now = new Date("2026-10-13T10:00:00.000Z");

function actors() {
  return Object.fromEntries(
    ROSSI_ACTORS.map((actor) => [actor.key, { ...actor, id: demoId(`rossi:actor:${actor.key}`) }])
  ) as Parameters<typeof buildRossiDataset>[0]["actors"];
}

function memoryRepo(seed: string[]): SessionMutationRepo & { tables: Map<string, { mutations: DemoMutation[]; version: number }> } {
  const tables = new Map(seed.map((id) => [id, { mutations: [] as DemoMutation[], version: 0 }]));
  return {
    tables,
    async read(sessionId) {
      const row = tables.get(sessionId);
      return row ? { mutations: [...row.mutations], version: row.version } : null;
    },
    async compareAndSwap(sessionId, expectedVersion, mutations, nextVersion) {
      const row = tables.get(sessionId);
      if (!row || row.version !== expectedVersion) return false;
      row.mutations = mutations;
      row.version = nextVersion;
      return true;
    },
  };
}

function stageMutation(id: string, dealId: string): DemoMutation {
  return {
    id,
    type: "deal.stage",
    dealId,
    stage: "NEGOTIATING",
    at: now.toISOString(),
    actorUserId: demoId("rossi:actor:tinashe"),
  };
}

describe("Rossi guest journey", () => {
  const cast = actors();
  const base = buildRossiDataset({ now, clientId, actors: cast });
  const tinasheId = cast.tinashe.id;
  const owned = base.deals.filter((deal) => deal.owner_id === tinasheId);
  const target = owned.find((deal) => deal.stage !== "NEGOTIATING");

  it("binds the salesperson persona to that person's fictional deals", () => {
    assert.ok(target);
    assert.equal(tinasheId, demoId("rossi:actor:tinashe"));
    assert.ok(owned.length > 0);
    assert.ok(base.deals.some((deal) => deal.owner_id !== tinasheId));
    assert.equal(base.deals.every((deal) => deal.client_id === clientId), true);
    assert.equal(findDemoPersona("tyres", "rossi", "tinashe")?.role, "SALESPERSON");
  });

  it("keeps a stage change after the session log is read again", async () => {
    assert.ok(target);
    const repo = memoryRepo(["visitor-1"]);
    const mutation = stageMutation("stage-1", target.id);
    await appendSessionMutationWithRepo(repo, "visitor-1", mutation);
    const restored = repo.tables.get("visitor-1");
    assert.ok(restored);
    const dataset = applyDemoMutations(base, restored.mutations);
    assert.equal(dataset.deals.find((deal) => deal.id === target.id)?.stage, "NEGOTIATING");
  });

  it("shows the stage change on the manager dashboard for the same session", async () => {
    assert.ok(target);
    const before = buildDemoCompanyDashboard(base).funnel.find((row) => row.id === "deals")?.count ?? 0;
    const repo = memoryRepo(["visitor-1"]);
    await appendSessionMutationWithRepo(repo, "visitor-1", stageMutation("stage-1", target.id));
    const dataset = applyDemoMutations(base, repo.tables.get("visitor-1")?.mutations ?? []);
    const after = buildDemoCompanyDashboard(dataset).funnel.find((row) => row.id === "deals")?.count ?? 0;
    assert.equal(after, before + 1);
    assert.equal(findDemoPersona("tyres", "rossi", "tendai")?.role, "CLIENT_MANAGER");
  });

  it("gives a second visitor the canonical dataset", async () => {
    assert.ok(target);
    const repo = memoryRepo(["visitor-1", "visitor-2"]);
    await appendSessionMutationWithRepo(repo, "visitor-1", stageMutation("stage-1", target.id));
    const second = applyDemoMutations(base, repo.tables.get("visitor-2")?.mutations ?? []);
    assert.equal(second.deals.find((deal) => deal.id === target.id)?.stage, target.stage);
    assert.equal(repo.tables.get("visitor-2")?.version, 0);
  });

  it("keeps the same mutation log when the persona changes", async () => {
    assert.ok(target);
    const repo = memoryRepo(["visitor-1"]);
    await appendSessionMutationWithRepo(repo, "visitor-1", stageMutation("stage-1", target.id));
    const persona = findDemoPersona("tyres", "rossi", "tendai");
    assert.equal(persona?.key, "tendai");
    assert.equal(repo.tables.get("visitor-1")?.mutations.length, 1);
    assert.equal(demoId(`rossi:actor:${persona?.key}`), cast.tendai.id);
  });

  it("stops access when the invitation is revoked", () => {
    const open = { expires_at: "2026-10-20T00:00:00.000Z", revoked_at: null };
    assert.equal(invitationAccess(open, now.getTime()), "valid");
    assert.equal(
      invitationAccess({ ...open, revoked_at: now.toISOString() }, now.getTime()),
      "revoked"
    );
  });
});
