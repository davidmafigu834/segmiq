import type { Session } from "next-auth";
import { ROSSI_ACTORS, type DemoActorKey } from "@/lib/demo/actors";
import { enterGuestContext, type DemoGuestContext } from "@/lib/demo/context";
import {
  DEMO_INVITATION_DEFAULT_MS,
  DEMO_INVITATION_MAX_MS,
  DEMO_SESSION_TTL_MS,
  isGuestAccessEnabled,
} from "@/lib/demo/deployment";
import { DemoAccessDenied } from "@/lib/demo/errors";
import { demoId } from "@/lib/demo/ids";
import { getWorkspaceConfig } from "@/lib/demo/mode";
import { defaultDemoPersona, findDemoPersona } from "@/lib/demo/personas";
import { findDemoTemplate } from "@/lib/demo/template-catalog";
import { invitationAccess } from "@/lib/demo/invitation-access";
import { hashToken } from "@/lib/demo/token-hash";

export type LoadedGuest = DemoGuestContext & { expiresAt: string };

export { invitationAccess } from "@/lib/demo/invitation-access";

type SessionRow = {
  id: string;
  client_id: string;
  persona_key: string;
  secret_hash: string;
  expires_at: string;
  revoked_at: string | null;
  invitation_id: string;
};

export async function loadGuestBySecret(secret: string): Promise<LoadedGuest | null> {
  if (!isGuestAccessEnabled() || !secret) return null;
  const secretHash = await hashToken(secret);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("demo_sessions")
    .select("id, client_id, persona_key, secret_hash, expires_at, revoked_at, invitation_id")
    .eq("secret_hash", secretHash)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as SessionRow;
  if (invitationAccess(row) !== "valid") return null;

  const invitation = await supabase
    .from("demo_invitations")
    .select("revoked_at, expires_at")
    .eq("id", row.invitation_id)
    .maybeSingle();
  if (invitation.error || !invitation.data) return null;
  const invite = invitation.data as { revoked_at: string | null; expires_at: string };
  if (invitationAccess(invite) !== "valid") return null;

  const config = await getWorkspaceConfig(row.client_id);
  if (!config || config.mode !== "demo") return null;
  const template = findDemoTemplate(config.industry, config.scenario);
  const persona = findDemoPersona(config.industry, config.scenario, row.persona_key);
  if (!template || !persona) return null;

  return {
    kind: "demo-guest",
    sessionId: row.id,
    clientId: row.client_id,
    personaKey: persona.key,
    userId: demoId(`${template.idPrefix}:actor:${persona.key}`),
    role: persona.role,
    name: persona.name,
    expiresAt: row.expires_at,
  };
}

export function bindGuest(guest: LoadedGuest): void {
  enterGuestContext(guest);
}

export function guestToSession(guest: LoadedGuest): Session & { demoGuest: true } {
  return {
    userId: guest.userId,
    role: guest.role,
    clientId: guest.clientId,
    clientMode: "team",
    alsoSells: false,
    sessionId: guest.sessionId,
    demoGuest: true,
    expires: guest.expiresAt,
    user: {
      id: guest.userId,
      name: guest.name,
      email: null,
    },
  };
}

export type RedeemResult =
  | { ok: true; secret: string; redirectTo: string; expiresAt: string }
  | { ok: false; status: 404 | 410 | 429; error: string };

export type InvitationRecord = {
  id: string;
  client_id: string;
  expires_at: string;
  revoked_at: string | null;
};

export type DemoRedeemStore = {
  findByTokenHash(tokenHash: string): Promise<InvitationRecord | null>;
  workspace(clientId: string): Promise<{ mode: string; industry: string | null; scenario: string | null } | null>;
  insertSession(row: {
    invitation_id: string;
    client_id: string;
    persona_key: string;
    secret_hash: string;
    expires_at: string;
  }): Promise<string | null>;
  insertMutationLog(sessionId: string): Promise<boolean>;
  deleteSession(sessionId: string): Promise<void>;
};

/** Invitation redemption without a live database. The HTTP route uses this through Supabase. */
export async function redeemInvitationWithStore(
  token: string,
  store: DemoRedeemStore,
  now = Date.now()
): Promise<RedeemResult> {
  const tokenHash = await hashToken(token);
  const invitation = await store.findByTokenHash(tokenHash);
  const access = invitationAccess(invitation, now);
  if (access === "revoked") return { ok: false, status: 410, error: "Revoked" };
  if (access === "expired") return { ok: false, status: 410, error: "Expired" };
  if (access !== "valid" || !invitation) return { ok: false, status: 404, error: "Not found" };

  const config = await store.workspace(invitation.client_id);
  if (!config || config.mode !== "demo") return { ok: false, status: 404, error: "Not found" };
  const personaKey = defaultDemoPersona(config.industry, config.scenario);
  const persona = personaKey ? findDemoPersona(config.industry, config.scenario, personaKey) : null;
  if (!personaKey || !persona) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const { generateOpaqueToken } = await import("@/lib/demo/tokens");
  const secret = generateOpaqueToken();
  const secretHash = await hashToken(secret);
  const expiresAt = new Date(now + DEMO_SESSION_TTL_MS).toISOString();
  const sessionId = await store.insertSession({
    invitation_id: invitation.id,
    client_id: invitation.client_id,
    persona_key: personaKey,
    secret_hash: secretHash,
    expires_at: expiresAt,
  });
  if (!sessionId) throw new Error("Demo session could not be created.");
  const mutationsOk = await store.insertMutationLog(sessionId);
  if (!mutationsOk) {
    await store.deleteSession(sessionId);
    throw new Error("Demo session state could not be created.");
  }
  const redirectTo = persona.role === "CLIENT_MANAGER" ? "/client/dashboard" : "/sales/dashboard";
  return { ok: true, secret, redirectTo, expiresAt };
}

export async function redeemInvitation(input: {
  token: string;
  ipHash: string;
}): Promise<RedeemResult> {
  if (!isGuestAccessEnabled()) return { ok: false, status: 404, error: "Not found" };
  const { checkDbRateLimit } = await import("@/lib/auth/db-rate-limit");
  const limit = await checkDbRateLimit({
    key: `demo-redeem:${input.ipHash}`.slice(0, 512),
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.ok) return { ok: false, status: 429, error: "Too many attempts" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  return redeemInvitationWithStore(input.token, {
    async findByTokenHash(tokenHash) {
      const { data, error } = await supabase
        .from("demo_invitations")
        .select("id, client_id, expires_at, revoked_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error || !data) return null;
      return data as InvitationRecord;
    },
    async workspace(clientId) {
      const config = await getWorkspaceConfig(clientId);
      if (!config) return null;
      return { mode: config.mode, industry: config.industry, scenario: config.scenario };
    },
    async insertSession(row) {
      const inserted = await supabase.from("demo_sessions").insert(row).select("id").single();
      if (inserted.error || !inserted.data?.id) return null;
      return inserted.data.id as string;
    },
    async insertMutationLog(sessionId) {
      const mutations = await supabase.from("demo_session_mutations").insert({
        session_id: sessionId,
        mutations: [],
        version: 0,
      });
      return !mutations.error;
    },
    async deleteSession(sessionId) {
      await supabase.from("demo_sessions").delete().eq("id", sessionId);
    },
  });
}

export async function switchGuestPersona(sessionId: string, clientId: string, personaKey: string): Promise<DemoGuestContext> {
  const config = await getWorkspaceConfig(clientId);
  if (!config || config.mode !== "demo") throw new DemoAccessDenied();
  const template = findDemoTemplate(config.industry, config.scenario);
  const persona = findDemoPersona(config.industry, config.scenario, personaKey);
  if (!template || !persona) throw new DemoAccessDenied();
  const { createUnguardedAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createUnguardedAdminClient();
  const { error } = await supabase
    .from("demo_sessions")
    .update({ persona_key: persona.key })
    .eq("id", sessionId)
    .eq("client_id", clientId)
    .is("revoked_at", null);
  if (error) throw new Error("Persona could not be updated.");
  return {
    kind: "demo-guest",
    sessionId,
    clientId,
    personaKey: persona.key,
    userId: demoId(`${template.idPrefix}:actor:${persona.key}`),
    role: persona.role,
    name: persona.name,
  };
}

export function invitationExpiry(requestedMs: number | null, now = Date.now()): string | null {
  const ms = requestedMs == null ? DEMO_INVITATION_DEFAULT_MS : requestedMs;
  if (!Number.isFinite(ms) || ms <= 0 || ms > DEMO_INVITATION_MAX_MS) return null;
  return new Date(now + ms).toISOString();
}

export async function createDemoInvitation(input: {
  clientId: string;
  createdBy: string;
  lifetimeMs?: number | null;
}): Promise<{ invitationId: string; token: string; expiresAt: string }> {
  const config = await getWorkspaceConfig(input.clientId);
  if (!config || config.mode !== "demo") throw new DemoAccessDenied();
  if (!findDemoTemplate(config.industry, config.scenario)) throw new DemoAccessDenied();
  const expiresAt = invitationExpiry(input.lifetimeMs ?? null);
  if (!expiresAt) throw new DemoAccessDenied();
  const { generateOpaqueToken } = await import("@/lib/demo/tokens");
  const token = generateOpaqueToken();
  const tokenHash = await hashToken(token);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const inserted = await supabase
    .from("demo_invitations")
    .insert({
      client_id: input.clientId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data?.id) throw new Error("Invitation could not be created.");
  return { invitationId: inserted.data.id as string, token, expiresAt };
}

export async function revokeDemoInvitation(invitationId: string): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const invitation = await supabase
    .from("demo_invitations")
    .update({ revoked_at: now })
    .eq("id", invitationId)
    .select("id");
  if (invitation.error) throw new Error("Invitation could not be revoked.");
  const sessions = await supabase
    .from("demo_sessions")
    .update({ revoked_at: now })
    .eq("invitation_id", invitationId)
    .is("revoked_at", null);
  if (sessions.error) throw new Error("Demo sessions could not be revoked.");
}

export function isRossiPersonaKey(value: string): value is DemoActorKey {
  return ROSSI_ACTORS.some((actor) => actor.key === value);
}
