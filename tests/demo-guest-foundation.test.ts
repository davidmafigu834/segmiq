import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { P } from "../lib/auth/rbac/permissions";
import { hasPermission } from "../lib/auth/rbac/resolve";
import {
  credentialsConflict,
  demoGuestHome,
  isDemoGuestApiAllowed,
  isDemoGuestPageAllowed,
} from "../lib/demo/allowlist";
import { readDemoSessionCookie } from "../lib/demo/cookie";
import { demoCronSkip } from "../lib/demo/cron";
import {
  DEMO_SESSION_COOKIE,
  assertDemoDatabaseAllowed,
  demoSessionCookieOptions,
  guestAccessBlockReason,
  isGuestAccessEnabled,
  DEMO_GUEST_SCHEMA_VERSION,
  isSharedDemoDatabase,
} from "../lib/demo/deployment";
import { excludeDemoWorkspaces } from "../lib/demo/cron";
import { enterGuestContext, runAsGuest, type DemoGuestContext } from "../lib/demo/context";
import { DemoAccessDenied } from "../lib/demo/errors";
import { assertGuestRepositoryAccess } from "../lib/demo/repository-guard";
import { PINNED_WORKSPACE_COLUMNS, requirePinnedWorkspaceId } from "../lib/demo/workspace-lookup";
import { decideEgress } from "../lib/demo/egress";
import { invitationAccess } from "../lib/demo/invitation-access";
import { invitationExpiry, redeemInvitationWithStore, type DemoRedeemStore } from "../lib/demo/guest-session";
import { materializeDemoDataset } from "../lib/demo/provider";
import { ROSSI_ACTORS } from "../lib/demo/actors";
import { demoId } from "../lib/demo/ids";
import { findDemoPersona } from "../lib/demo/personas";
import { appendSessionMutationWithRepo, type SessionMutationRepo } from "../lib/demo/session-store";
import { hashToken } from "../lib/demo/token-hash";
import type { DemoMutation } from "../lib/demo/types";

const originalDeployment = process.env.SEGMQ_DEPLOYMENT;
const originalGuest = process.env.SEGMQ_DEMO_GUEST_ACCESS;
const originalDatabase = process.env.SEGMQ_DEMO_DATABASE;
const originalSchema = process.env.SEGMQ_DEMO_SCHEMA;

afterEach(() => {
  if (originalDeployment === undefined) delete process.env.SEGMQ_DEPLOYMENT;
  else process.env.SEGMQ_DEPLOYMENT = originalDeployment;
  if (originalGuest === undefined) delete process.env.SEGMQ_DEMO_GUEST_ACCESS;
  else process.env.SEGMQ_DEMO_GUEST_ACCESS = originalGuest;
  if (originalDatabase === undefined) delete process.env.SEGMQ_DEMO_DATABASE;
  else process.env.SEGMQ_DEMO_DATABASE = originalDatabase;
  if (originalSchema === undefined) delete process.env.SEGMQ_DEMO_SCHEMA;
  else process.env.SEGMQ_DEMO_SCHEMA = originalSchema;
});

function mutation(id: string): DemoMutation {
  return {
    id,
    type: "deal.stage",
    dealId: "deal-1",
    stage: "NEGOTIATING",
    at: "2026-10-12T00:00:00.000Z",
    actorUserId: "user-1",
  };
}

describe("guest access gate", () => {
  it("stays disabled unless this process is the isolated demo deployment and the switch is on", () => {
    assert.equal(guestAccessBlockReason({}), "guest-access-disabled");
    assert.equal(guestAccessBlockReason({ SEGMQ_DEPLOYMENT: "demo" }), "guest-access-disabled");
    assert.equal(isGuestAccessEnabled({ SEGMQ_DEMO_GUEST_ACCESS: "enabled" }), false);
    assert.equal(
      guestAccessBlockReason({
        SEGMQ_DEMO_GUEST_ACCESS: "enabled",
        SEGMQ_DEMO_DATABASE: "shared",
      }),
      "guest-schema-not-ready"
    );
    assert.equal(
      guestAccessBlockReason({
        SEGMQ_DEMO_GUEST_ACCESS: "enabled",
        SEGMQ_DEMO_DATABASE: "shared",
        SEGMQ_DEMO_SCHEMA: DEMO_GUEST_SCHEMA_VERSION,
      }),
      null
    );
    assert.equal(
      guestAccessBlockReason({ SEGMQ_DEPLOYMENT: "demo", SEGMQ_DEMO_GUEST_ACCESS: "enabled" }),
      "guest-schema-not-ready"
    );
    assert.equal(
      guestAccessBlockReason({
        SEGMQ_DEPLOYMENT: "demo",
        SEGMQ_DEMO_GUEST_ACCESS: "enabled",
        SEGMQ_DEMO_SCHEMA: DEMO_GUEST_SCHEMA_VERSION,
      }),
      "supabase-project-unpinned"
    );
    const pinned = {
      SEGMQ_DEPLOYMENT: "demo",
      SEGMQ_DEMO_GUEST_ACCESS: "enabled",
      SEGMQ_DEMO_SCHEMA: DEMO_GUEST_SCHEMA_VERSION,
      SEGMQ_DEMO_SUPABASE_REF: "demodemo",
      SEGMQ_PRODUCTION_SUPABASE_REF: "prodprod",
      NEXT_PUBLIC_SUPABASE_URL: "https://demodemo.supabase.co",
    };
    assert.equal(isGuestAccessEnabled(pinned), true);
    assert.equal(
      guestAccessBlockReason({ ...pinned, NEXT_PUBLIC_SUPABASE_URL: "https://prodprod.supabase.co" }),
      "production-database-refused"
    );
    assert.throws(
      () =>
        assertDemoDatabaseAllowed({
          SEGMQ_DEPLOYMENT: "demo",
          SEGMQ_PRODUCTION_SUPABASE_REF: "prodprod",
          NEXT_PUBLIC_SUPABASE_URL: "https://prodprod.supabase.co",
        }),
      /production Supabase project/
    );
    assert.doesNotThrow(() => assertDemoDatabaseAllowed({ SEGMQ_DEPLOYMENT: "production" }));
  });

  it("treats a CRM session plus a demo cookie as a conflict", () => {
    assert.equal(credentialsConflict(true, true), true);
    assert.equal(credentialsConflict(true, false), false);
    assert.equal(credentialsConflict(false, true), false);
  });

  it("stores only a hash of the invitation secret", async () => {
    const token = "invitation-secret-value";
    const hashed = await hashToken(token);
    assert.notEqual(hashed, token);
    assert.equal(hashed.length, 64);
    assert.equal(await hashToken(token), hashed);
  });

  it("uses an HttpOnly cookie that is Secure in production", () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    const options = demoSessionCookieOptions(60);
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, "lax");
    env.NODE_ENV = "test";
    assert.equal(demoSessionCookieOptions(60).secure, false);
    env.NODE_ENV = previous;
  });

  it("reads the session cookie without treating it as the invitation token", () => {
    const header = `theme=light; ${DEMO_SESSION_COOKIE}=session-secret`;
    assert.equal(readDemoSessionCookie(header), "session-secret");
    assert.equal(readDemoSessionCookie("other=1"), null);
  });

  it("rejects an invitation lifetime above 30 days", () => {
    assert.equal(invitationExpiry(31 * 24 * 60 * 60 * 1000), null);
    assert.ok(invitationExpiry(60 * 60 * 1000));
  });

  it("enables guests on the shared database without stopping production jobs", () => {
    assert.equal(isSharedDemoDatabase({ SEGMQ_DEMO_DATABASE: "shared" }), true);
    assert.equal(
      isGuestAccessEnabled({
        SEGMQ_DEMO_DATABASE: "shared",
        SEGMQ_DEMO_GUEST_ACCESS: "enabled",
        SEGMQ_DEMO_SCHEMA: DEMO_GUEST_SCHEMA_VERSION,
      }),
      true
    );
    process.env.SEGMQ_DEMO_DATABASE = "shared";
    process.env.SEGMQ_DEMO_GUEST_ACCESS = "enabled";
    process.env.SEGMQ_DEMO_SCHEMA = DEMO_GUEST_SCHEMA_VERSION;
    delete process.env.SEGMQ_DEPLOYMENT;
    assert.equal(demoCronSkip(), null);
    const calls: string[][] = [];
    const query = {
      neq(column: string, value: string) {
        calls.push([column, value]);
        return query;
      },
    };
    excludeDemoWorkspaces(query);
    assert.deepEqual(calls, [["workspace_mode", "demo"]]);
  });
});

describe("guest permissions", () => {
  const actor = {
    userId: "persona",
    clientId: "demo-client",
    alsoSells: false as const,
  };

  it("does not grant platform permissions to either Rossi persona", () => {
    for (const role of ["SALESPERSON", "CLIENT_MANAGER"] as const) {
      assert.equal(hasPermission({ ...actor, role }, P.PLATFORM_IMPERSONATE), false);
      assert.equal(hasPermission({ ...actor, role }, P.PLATFORM_CLIENTS_MANAGE), false);
      assert.equal(hasPermission({ ...actor, role }, P.PLATFORM_BILLING_MANAGE), false);
    }
  });

  it("allows only configured personas and the pages for that role", () => {
    assert.equal(findDemoPersona("tyres", "rossi", "tinashe")?.role, "SALESPERSON");
    assert.equal(findDemoPersona("tyres", "rossi", "tendai")?.role, "CLIENT_MANAGER");
    assert.equal(findDemoPersona("tyres", "rossi", "super"), null);
    assert.equal(findDemoPersona("solar", "sunvolt", "tinashe"), null);
    assert.equal(isDemoGuestPageAllowed("/sales/pipeline", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/inbox", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/inbox/needs-reply", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/leads", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/quotes", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/quotes/quote-1", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/tasks", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/calendar", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/reports", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/won-lost", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/goals", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/social-inbox", "SALESPERSON"), true);
    assert.equal(isDemoGuestPageAllowed("/sales/profile", "SALESPERSON"), false);
    assert.equal(isDemoGuestPageAllowed("/dashboard", "CLIENT_MANAGER"), false);
    assert.equal(isDemoGuestPageAllowed("/client/billing", "CLIENT_MANAGER"), false);
    assert.equal(isDemoGuestPageAllowed("/client/dashboard", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/inbox", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/leads", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/team", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/calendar", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/reports", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/social-inbox", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/command", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/products", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/inventory", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/packages", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/documents", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/agent", "CLIENT_MANAGER"), true);
    assert.equal(isDemoGuestPageAllowed("/client/settings", "CLIENT_MANAGER"), false);
    assert.equal(isDemoGuestPageAllowed("/client/billing", "CLIENT_MANAGER"), false);
    assert.equal(demoGuestHome("CLIENT_MANAGER"), "/client/dashboard");
    assert.equal(isDemoGuestApiAllowed("/api/deals/abc", "PATCH"), true);
    assert.equal(isDemoGuestApiAllowed("/api/inbox/conversations", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/inbox/conversations", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/inbox/conversations/lead-1/messages", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/inbox/conversations/lead-1/messages", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/inbox/quick-replies", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/inbox/quick-replies", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/sales/leads", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/sales/leads", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/sales/quotes", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/sales/tasks", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/sales/won-lost", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/sales/reports", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/sales/goals", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/leads/abc", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/agent/sales/command", "POST"), true);
    assert.equal(isDemoGuestApiAllowed("/api/sales/dashboard/workspace", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/sales/copilot/conversations/lead-1", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/sales/copilot/work-items/item-1", "POST"), true);
    assert.equal(isDemoGuestApiAllowed("/api/sales/copilot/settings", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/agent/sales/command", "DELETE"), false);
    assert.equal(isDemoGuestApiAllowed("/api/leads/abc/send-message", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/whatsapp/connection", "GET"), false);
    assert.equal(isDemoGuestApiAllowed("/api/client/team/member-1", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/client/team/goals", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/leads/abc", "PATCH"), false);
    assert.equal(isDemoGuestApiAllowed("/api/agency/impersonate", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/billing/payments", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/clients/abc/users", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/demo/reset", "POST"), false);
    assert.equal(isDemoGuestApiAllowed("/api/auth/session", "GET"), true);
    assert.equal(isDemoGuestApiAllowed("/api/auth/callback/credentials", "POST"), false);
  });
});

describe("session mutation isolation", () => {
  it("keeps two visitors on independent logs and retries a conflicting write", async () => {
    const tables = new Map<string, { mutations: DemoMutation[]; version: number }>([
      ["session-a", { mutations: [], version: 0 }],
      ["session-b", { mutations: [], version: 0 }],
    ]);
    let conflictsLeft = 1;
    const repo: SessionMutationRepo = {
      async read(sessionId) {
        const row = tables.get(sessionId);
        return row ? { mutations: [...row.mutations], version: row.version } : null;
      },
      async compareAndSwap(sessionId, expectedVersion, mutations, nextVersion) {
        const row = tables.get(sessionId);
        if (!row || row.version !== expectedVersion) return false;
        if (sessionId === "session-a" && conflictsLeft > 0) {
          conflictsLeft -= 1;
          row.version += 1;
          return false;
        }
        row.mutations = mutations;
        row.version = nextVersion;
        return true;
      },
    };

    await appendSessionMutationWithRepo(repo, "session-a", mutation("a1"));
    await appendSessionMutationWithRepo(repo, "session-b", mutation("b1"));
    assert.deepEqual(tables.get("session-a")?.mutations.map((row) => row.id), ["a1"]);
    assert.deepEqual(tables.get("session-b")?.mutations.map((row) => row.id), ["b1"]);
    assert.equal(tables.get("session-a")?.version, 2);
  });

  it("keeps both mutations when two writes race on one session", async () => {
    const tables = new Map<string, { mutations: DemoMutation[]; version: number }>([
      ["session-a", { mutations: [], version: 0 }],
    ]);
    const repo: SessionMutationRepo = {
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
    await Promise.all([
      appendSessionMutationWithRepo(repo, "session-a", mutation("a1")),
      appendSessionMutationWithRepo(repo, "session-a", mutation("a2")),
    ]);
    const ids = tables.get("session-a")?.mutations.map((row) => row.id).sort();
    assert.deepEqual(ids, ["a1", "a2"]);
    assert.equal(tables.get("session-a")?.version, 2);
  });
});

describe("external action boundary", () => {
  it("refuses demo deployment, guest context, and demo workspaces", () => {
    assert.equal(decideEgress({ deploymentDemo: false, guest: false, workspaceDemo: false }), "allow");
    assert.equal(decideEgress({ deploymentDemo: true, guest: false, workspaceDemo: false }), "refuse");
    assert.equal(decideEgress({ deploymentDemo: false, guest: true, workspaceDemo: false }), "refuse");
    assert.equal(decideEgress({ deploymentDemo: false, guest: false, workspaceDemo: true }), "refuse");
  });

  it("does not call Resend, Zoho, or the WhatsApp gateway from a demo deployment", async () => {
    process.env.SEGMQ_DEPLOYMENT = "demo";
    const { sendEmail } = await import("../lib/email/resend");
    const email = await sendEmail({ to: "person@example.com", subject: "x", html: "<p>x</p>" });
    assert.equal(email.success, false);
    assert.equal(email.error, "DEMO_EGRESS_BLOCKED");

    let zohoCalls = 0;
    const { zohoBooksGet, ZohoBooksRequestError } = await import("../lib/zoho-books/http");
    await assert.rejects(
      () =>
        zohoBooksGet({
          apiDomain: "https://www.zohoapis.com",
          accessToken: "token",
          path: "/invoices",
          fetchImpl: async () => {
            zohoCalls += 1;
            return new Response("{}", { status: 200 });
          },
        }),
      (error: unknown) => error instanceof ZohoBooksRequestError && error.message === "DEMO_EGRESS_BLOCKED"
    );
    assert.equal(zohoCalls, 0);

    let gatewayCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      gatewayCalls += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      const { callWhatsAppGateway } = await import("../lib/whatsapp/gateway-client");
      await assert.rejects(() => callWhatsAppGateway({ path: "/session" }), /DEMO_EGRESS_BLOCKED/);
      assert.equal(gatewayCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("blocks agent tools before execution on a demo deployment", async () => {
    process.env.SEGMQ_DEPLOYMENT = "demo";
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      const { runAgentTool } = await import("../lib/agent/tools/execute");
      const result = await runAgentTool(
        {
          clientId: "demo-client",
          leadId: "lead",
          contactId: null,
          ownerId: null,
          ownerName: null,
          executionId: "exec",
          timezone: "Africa/Harare",
          settings: {} as never,
          testMode: false,
        },
        "quotation_send",
        {}
      );
      assert.equal(result.status, "BLOCKED");
      assert.equal(result.blockedReason, "DEMO_EGRESS_BLOCKED");
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("skips schedulers on the demo deployment", () => {
    delete process.env.SEGMQ_DEPLOYMENT;
    assert.equal(demoCronSkip(), null);
    process.env.SEGMQ_DEPLOYMENT = "demo";
    assert.equal(demoCronSkip()?.status, 200);
  });
});

describe("invitation redemption", () => {
  const now = Date.parse("2026-10-12T12:00:00.000Z");

  function store(invitation: {
    expires_at: string;
    revoked_at: string | null;
    mode?: string;
    industry?: string | null;
    scenario?: string | null;
  } | null): DemoRedeemStore & { deleted: string[]; sessions: number } {
    const state = { deleted: [] as string[], sessions: 0 };
    return {
      ...state,
      async findByTokenHash() {
        if (!invitation) return null;
        return { id: "invite-1", client_id: "rossi", ...invitation };
      },
      async workspace() {
        if (!invitation) return null;
        return {
          mode: invitation.mode ?? "demo",
          industry: invitation.industry === undefined ? "tyres" : invitation.industry,
          scenario: invitation.scenario === undefined ? "rossi" : invitation.scenario,
        };
      },
      async insertSession() {
        state.sessions += 1;
        return "session-1";
      },
      async insertMutationLog() {
        return true;
      },
      async deleteSession(sessionId) {
        state.deleted.push(sessionId);
      },
    };
  }

  it("rejects a missing, expired, or revoked invitation", async () => {
    assert.equal(invitationAccess(null, now), "missing");
    const missing = await redeemInvitationWithStore("missing", store(null), now);
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 404);
    const expired = await redeemInvitationWithStore(
      "expired",
      store({ expires_at: "2026-10-01T00:00:00.000Z", revoked_at: null }),
      now
    );
    assert.equal(expired.ok, false);
    if (!expired.ok) assert.equal(expired.status, 410);
    const revoked = await redeemInvitationWithStore(
      "revoked",
      store({ expires_at: "2026-10-20T00:00:00.000Z", revoked_at: "2026-10-11T00:00:00.000Z" }),
      now
    );
    assert.equal(revoked.ok, false);
    if (!revoked.ok) assert.equal(revoked.status, 410);
  });

  it("issues a separate session secret for a valid Rossi invitation", async () => {
    const result = await redeemInvitationWithStore(
      "invite-secret",
      store({ expires_at: "2026-10-20T00:00:00.000Z", revoked_at: null }),
      now
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.notEqual(result.secret, "invite-secret");
      assert.equal(result.redirectTo, "/sales/dashboard");
    }
  });

  it("refuses a production workspace and deletes a session whose mutation log fails", async () => {
    const production = await redeemInvitationWithStore(
      "invite-secret",
      store({ expires_at: "2026-10-20T00:00:00.000Z", revoked_at: null, mode: "production" }),
      now
    );
    assert.equal(production.ok, false);
    const failing = store({ expires_at: "2026-10-20T00:00:00.000Z", revoked_at: null });
    failing.insertMutationLog = async () => false;
    await assert.rejects(() => redeemInvitationWithStore("invite-secret", failing, now), /session state/);
    assert.deepEqual(failing.deleted, ["session-1"]);
  });
});

describe("guest repository boundary", () => {
  const guest: DemoGuestContext = {
    kind: "demo-guest",
    sessionId: "session-1",
    clientId: "rossi",
    personaKey: "tinashe",
    userId: "user-1",
    role: "SALESPERSON",
    name: "Tinashe Moyo",
  };

  it("denies CRM tables and platform roles while the guest context is active", () => {
    assert.throws(() => enterGuestContext({ ...guest, role: "SUPER_ADMIN" } as unknown as DemoGuestContext));
    runAsGuest(guest, () => {
      assert.throws(() => assertGuestRepositoryAccess("clients"), DemoAccessDenied);
      assert.throws(() => assertGuestRepositoryAccess("leads"), DemoAccessDenied);
      assert.throws(() => assertGuestRepositoryAccess("deals"), DemoAccessDenied);
      assert.throws(() => assertGuestRepositoryAccess("users"), DemoAccessDenied);
      assert.doesNotThrow(() => assertGuestRepositoryAccess("demo_sessions"));
    });
    assert.doesNotThrow(() => assertGuestRepositoryAccess("leads"));
    assert.doesNotThrow(() => assertGuestRepositoryAccess("clients"));
  });

  it("refuses another organisation id and does not select integration secrets", () => {
    assert.equal(requirePinnedWorkspaceId("rossi", "rossi"), "rossi");
    assert.throws(() => requirePinnedWorkspaceId("rossi", "other-company"), DemoAccessDenied);
    assert.throws(() => requirePinnedWorkspaceId("rossi", null), DemoAccessDenied);
    assert.equal(PINNED_WORKSPACE_COLUMNS.includes("id"), true);
    assert.equal(PINNED_WORKSPACE_COLUMNS.includes("fb_"), false);
    assert.equal(PINNED_WORKSPACE_COLUMNS.includes("access_token"), false);
    assert.equal(PINNED_WORKSPACE_COLUMNS.split(",").some((column) => column.trim() === "*"), false);
  });

  it("keeps concurrent guest identities apart from each other and from production", async () => {
    const other: DemoGuestContext = { ...guest, sessionId: "session-2", clientId: "other-demo", personaKey: "tendai", role: "CLIENT_MANAGER", name: "Tendai" };
    const seen = await Promise.all([
      runAsGuest(guest, async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        const { getGuestContext } = await import("../lib/demo/context");
        return getGuestContext()?.sessionId ?? "missing";
      }),
      runAsGuest(other, async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        const { getGuestContext } = await import("../lib/demo/context");
        return getGuestContext()?.clientId ?? "missing";
      }),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        const { getGuestContext } = await import("../lib/demo/context");
        return getGuestContext()?.sessionId ?? "production";
      })(),
    ]);
    assert.deepEqual(seen, ["session-1", "other-demo", "production"]);
  });
});

describe("Rossi actor identity", () => {
  it("uses the same actor id for the persona and that person's deals", () => {
    const actors = Object.fromEntries(
      ROSSI_ACTORS.map((actor) => [
        actor.key,
        { ...actor, id: demoId(`rossi:actor:${actor.key}`) },
      ])
    ) as Parameters<typeof materializeDemoDataset>[0]["actors"];
    const dataset = materializeDemoDataset({
      industry: "tyres",
      scenario: "rossi",
      clientId: "rossi-client",
      actors,
      now: new Date("2026-10-12T12:00:00.000Z"),
    });
    assert.ok(dataset);
    const owned = dataset.deals.filter((deal) => deal.owner_id === actors.tinashe.id);
    assert.ok(owned.length > 0);
    assert.ok(dataset.deals.some((deal) => deal.owner_id !== actors.tinashe.id));
    assert.equal(dataset.deals.every((deal) => deal.client_id === "rossi-client"), true);
  });
});
