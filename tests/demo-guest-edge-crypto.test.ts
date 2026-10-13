import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { credentialsConflict } from "../lib/demo/allowlist";
import { guestAccessBlockReason, isGuestAccessEnabled } from "../lib/demo/deployment";
import { invitationAccess } from "../lib/demo/invitation-access";
import { redeemInvitationWithStore, type DemoRedeemStore } from "../lib/demo/guest-session";
import { hashToken } from "../lib/demo/token-hash";
import { generateOpaqueToken } from "../lib/demo/tokens";

const root = path.resolve(__dirname, "..");
const SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function nodeSha256(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function runtimeSpecifiers(source: string): string[] {
  const executable = source
    .replace(/import\s+type\s+[\s\S]*?\sfrom\s+["'][^"']+["']/g, "")
    .replace(/export\s+type\s+[\s\S]*?\sfrom\s+["'][^"']+["']/g, "");
  const specs = new Set<string>();
  for (const match of executable.matchAll(/from\s+["']([^"']+)["']/g)) specs.add(match[1]);
  for (const match of executable.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.add(match[1]);
  return [...specs];
}

function resolveProjectFile(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".") && !spec.startsWith("@/")) return null;
  const base = spec.startsWith("@/")
    ? path.join(root, spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, "index.ts")];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

/** Project files reachable from Middleware, including the dynamic guest gate. */
function middlewareGraph(): string[] {
  const start = path.join(root, "middleware.ts");
  const seen = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, "utf8");
    for (const spec of runtimeSpecifiers(source)) {
      const resolved = resolveProjectFile(file, spec);
      if (resolved) pending.push(resolved);
    }
  }
  return [...seen];
}

describe("edge guest token hashing", () => {
  it("matches Node SHA-256 and a known digest", async () => {
    const invitation = "invitation-secret-value";
    const hashed = await hashToken(invitation);
    assert.equal(hashed, nodeSha256(invitation));
    assert.equal(await hashToken("abc"), SHA256_ABC);
    assert.equal(await hashToken(invitation), hashed);
    assert.notEqual(hashed, invitation);
    assert.equal(hashed.length, 64);
  });

  it("hashes a session secret the same way an invitation token is hashed", async () => {
    const secret = generateOpaqueToken();
    assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
    const stored = await hashToken(secret);
    assert.equal(stored, nodeSha256(secret));
    assert.equal(await hashToken(secret), stored);
    assert.notEqual(await hashToken(generateOpaqueToken()), stored);
  });

  it("accepts only the hashed session secret and rejects invalid, expired, and revoked credentials", async () => {
    const now = Date.parse("2026-10-13T12:00:00.000Z");
    let stored: { secret_hash: string; expires_at: string } | null = null;
    const store: DemoRedeemStore = {
      async findByTokenHash(tokenHash) {
        assert.equal(tokenHash, await hashToken("invite-secret"));
        assert.notEqual(tokenHash, "invite-secret");
        return {
          id: "invite-1",
          client_id: "rossi",
          expires_at: "2026-10-20T00:00:00.000Z",
          revoked_at: null,
        };
      },
      async workspace() {
        return { mode: "demo", industry: "tyres", scenario: "rossi" };
      },
      async insertSession(row) {
        stored = { secret_hash: row.secret_hash, expires_at: row.expires_at };
        return "session-1";
      },
      async insertMutationLog() {
        return true;
      },
      async deleteSession() {},
    };

    const issued = await redeemInvitationWithStore("invite-secret", store, now);
    const saved = stored;
    assert.ok(saved);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    assert.equal(saved.secret_hash, await hashToken(issued.secret));
    assert.notEqual(saved.secret_hash, issued.secret);
    assert.notEqual(await hashToken("wrong-session-secret"), saved.secret_hash);
    assert.equal(invitationAccess({ expires_at: saved.expires_at, revoked_at: null }, now), "valid");
    assert.equal(
      invitationAccess({ expires_at: saved.expires_at, revoked_at: "2026-10-13T11:00:00.000Z" }, now),
      "revoked"
    );
    assert.equal(
      invitationAccess({ expires_at: "2026-10-13T11:00:00.000Z", revoked_at: null }, now),
      "expired"
    );
    assert.equal(invitationAccess(null, now), "missing");
  });

  it("keeps Node crypto out of the Middleware graph", () => {
    const files = middlewareGraph();
    const relative = files.map((file) => path.relative(root, file).replaceAll("\\", "/"));
    assert.ok(relative.includes("lib/demo/guest-gate.ts"));
    assert.ok(relative.includes("lib/demo/token-hash.ts"));
    assert.equal(relative.includes("lib/demo/tokens.ts"), false);
    const nodeCrypto = /(?:from\s+|import\s*\(\s*|require\(\s*)["'](?:node:)?(?:crypto|fs|async_hooks|child_process)["']/;
    const offenders = files.filter((file) => nodeCrypto.test(fs.readFileSync(file, "utf8")));
    assert.deepEqual(
      offenders.map((file) => path.relative(root, file)),
      []
    );
  });

  it("leaves production authentication in place and guest access disabled", () => {
    const middleware = fs.readFileSync(path.join(root, "middleware.ts"), "utf8");
    assert.match(middleware, /from "next-auth\/jwt"/);
    assert.match(middleware, /enforceApiMfaEnrolmentGate/);
    assert.equal(middleware.includes("lib/demo/tokens"), false);
    assert.equal(credentialsConflict(true, true), true);
    assert.equal(credentialsConflict(false, false), false);
    assert.equal(guestAccessBlockReason({}), "guest-access-disabled");
    assert.equal(isGuestAccessEnabled({}), false);
    assert.equal(isGuestAccessEnabled({ SEGMQ_DEPLOYMENT: "demo" }), false);
  });
});
