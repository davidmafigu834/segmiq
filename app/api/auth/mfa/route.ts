import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionFromRequest } from "@/lib/api-guards";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { checkSecurityRateLimit } from "@/lib/auth/security-rate-limit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/auth/user-sessions";
import {
  confirmTotpSetup,
  disableMfa,
  getMfaStatus,
  regenerateRecoveryCodes,
  startTotpSetup,
  verifyActiveTotp,
} from "@/lib/auth/mfa/service";
import { requireElevatedSession, elevateSession } from "@/lib/auth/step-up";
import { mfaPolicyForRole } from "@/lib/auth/mfa/policy";
import {
  sendSecurityNotification,
} from "@/lib/email/templates/security-alert";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeAllUserSessions } from "@/lib/auth/user-sessions";

export const dynamic = "force-dynamic";

async function guardMutation(req: Request) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return { error: NextResponse.json({ error: origin.error }, { status: origin.status }) };
  }
  return requireSessionFromRequest(req);
}

/** GET — MFA status for current user (no secrets). */
export async function GET(req: Request) {
  const g = await requireSessionFromRequest(req);
  if ("error" in g) return g.error;
  const status = await getMfaStatus(g.session.userId);
  return NextResponse.json({
    ...status,
    policy: mfaPolicyForRole(g.session.role),
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setup_start"), password: z.string().min(1).optional() }),
  z.object({ action: z.literal("setup_confirm"), code: z.string().min(6).max(12) }),
  z.object({
    action: z.literal("disable"),
    password: z.string().optional(),
    totpCode: z.string().optional(),
  }),
  z.object({
    action: z.literal("regenerate_recovery"),
    password: z.string().optional(),
    totpCode: z.string().optional(),
  }),
  z.object({
    action: z.literal("step_up"),
    password: z.string().optional(),
    totpCode: z.string().optional(),
  }),
]);

export async function POST(req: Request) {
  const g = await guardMutation(req);
  if ("error" in g) return g.error;

  const ip = clientIpFromRequest(req);
  const rl = checkSecurityRateLimit({
    key: `mfa:${g.session.userId}:${ip}`,
    limit: 30,
    windowMs: 15 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const parsed = actionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const body = parsed.data;
  const supabase = createAdminClient();
  const { data: userRow } = await supabase
    .from("users")
    .select("email, password")
    .eq("id", g.session.userId)
    .single();
  const email = String(userRow?.email ?? "");

  try {
    if (body.action === "setup_start") {
      const result = await startTotpSetup({
        userId: g.session.userId,
        email: email || "user@segmiq.com",
      });
      const qrDataUrl = await QRCode.toDataURL(result.otpauthUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 220,
      });
      return NextResponse.json({
        qrDataUrl,
        manualKey: result.manualKey,
        setupExpiresAt: result.setupExpiresAt,
      });
    }

    if (body.action === "setup_confirm") {
      const { recoveryCodes } = await confirmTotpSetup({
        userId: g.session.userId,
        code: body.code,
      });
      if (email) {
        void sendSecurityNotification({ to: email, kind: "mfa_enabled" });
      }
      // Elevate current session as MFA-verified for this login
      if (g.session.sessionId) {
        await supabase
          .from("user_sessions")
          .update({
            mfa_verified_at: new Date().toISOString(),
            auth_strength: "password_mfa",
            elevated_until: new Date(Date.now() + 10 * 60_000).toISOString(),
          })
          .eq("id", g.session.sessionId);
      }
      return NextResponse.json({ ok: true, recoveryCodes });
    }

    if (body.action === "step_up") {
      if (!g.session.sessionId) {
        return NextResponse.json({ error: "No active session" }, { status: 400 });
      }
      const result = await elevateSession({
        sessionId: g.session.sessionId,
        userId: g.session.userId,
        password: body.password,
        totpCode: body.totpCode,
      });
      if (!result.ok) {
        return NextResponse.json({ error: "Verification failed", reason: result.reason }, { status: 403 });
      }
      return NextResponse.json({ ok: true, elevatedUntil: result.elevatedUntil });
    }

    if (body.action === "disable") {
      // Prefer fresh step-up within this request (password+TOTP) rather than stale elevated alone.
      const mfaOk = body.totpCode ? await verifyActiveTotp(g.session.userId, body.totpCode) : false;
      if (!mfaOk) {
        return NextResponse.json(
          { error: "Authenticator code required to disable two-step verification" },
          { status: 403 }
        );
      }
      const { verifyPassword } = await import("@/lib/password");
      if (!body.password || !userRow?.password || !(await verifyPassword(body.password, String(userRow.password)))) {
        return NextResponse.json({ error: "Current password is required" }, { status: 403 });
      }
      await disableMfa({ userId: g.session.userId });
      await revokeAllUserSessions({
        userId: g.session.userId,
        reason: "ADMIN_REVOKED",
        exceptSessionId: g.session.sessionId,
      });
      if (email) void sendSecurityNotification({ to: email, kind: "mfa_disabled" });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "regenerate_recovery") {
      const elev = await requireElevatedSession({
        sessionId: g.session.sessionId,
        userId: g.session.userId,
      });
      // Also accept inline TOTP as step-up for this action
      let allowed = elev.ok;
      if (!allowed && body.totpCode && (await verifyActiveTotp(g.session.userId, body.totpCode))) {
        allowed = true;
        if (g.session.sessionId) {
          await elevateSession({
            sessionId: g.session.sessionId,
            userId: g.session.userId,
            totpCode: body.totpCode,
          });
        }
      }
      if (!allowed) {
        return NextResponse.json({ error: "Step-up authentication required" }, { status: 403 });
      }
      const recoveryCodes = await regenerateRecoveryCodes({ userId: g.session.userId });
      return NextResponse.json({ ok: true, recoveryCodes });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    if (message === "MFA_ALREADY_ENABLED") {
      return NextResponse.json({ error: "Two-step verification is already enabled" }, { status: 409 });
    }
    if (message === "NO_PENDING_SETUP" || message === "SETUP_EXPIRED") {
      return NextResponse.json({ error: "Setup expired. Start again." }, { status: 400 });
    }
    if (message === "INVALID_CODE") {
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 400 });
    }
    if (message === "MFA_NOT_ENABLED") {
      return NextResponse.json({ error: "Two-step verification is not enabled" }, { status: 400 });
    }
    console.warn("[mfa]", message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
