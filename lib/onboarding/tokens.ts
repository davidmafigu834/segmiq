import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ONBOARDING_TOKEN_TTL_DAYS, ONBOARDING_TOKEN_RENEW_COOLDOWN_MS } from "@/lib/onboarding/constants";

export function generateOnboardingToken(): string {
  return randomBytes(32).toString("hex");
}

export function onboardingTokenExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + ONBOARDING_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export type OnboardingTokenRow = {
  id: string;
  client_id: string;
  token: string;
  expires_at: string;
  used: boolean;
};

export async function createOnboardingToken(clientId: string): Promise<{ token: string; expiresAt: string }> {
  const supabase = createAdminClient();
  const token = generateOnboardingToken();
  const expiresAt = onboardingTokenExpiresAt();

  await supabase
    .from("client_onboarding_tokens")
    .update({ used: true })
    .eq("client_id", clientId)
    .eq("used", false);

  const { error } = await supabase.from("client_onboarding_tokens").insert({
    client_id: clientId,
    token,
    expires_at: expiresAt,
    used: false,
  });

  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

export async function findOnboardingToken(token: string): Promise<
  | {
      ok: true;
      row: OnboardingTokenRow;
      client: {
        id: string;
        mode: "team" | "solo";
        plan: string;
        owner_email: string | null;
        setup_status: string;
        onboarding_progress: Record<string, unknown>;
      };
    }
  | { ok: false; reason: "invalid" | "used" | "expired" }
> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_onboarding_tokens")
    .select(
      `id, client_id, token, expires_at, used,
      clients!inner (id, mode, plan, owner_email, setup_status, onboarding_progress)`
    )
    .eq("token", token)
    .maybeSingle();

  if (!data) return { ok: false, reason: "invalid" };

  const raw = data as OnboardingTokenRow & {
    clients:
      | {
          id: string;
          mode: string;
          plan: string;
          owner_email: string | null;
          setup_status: string;
          onboarding_progress: Record<string, unknown>;
        }
      | {
          id: string;
          mode: string;
          plan: string;
          owner_email: string | null;
          setup_status: string;
          onboarding_progress: Record<string, unknown>;
        }[];
  };

  if (raw.used) return { ok: false, reason: "used" };
  if (new Date(raw.expires_at) < new Date()) return { ok: false, reason: "expired" };

  const client = Array.isArray(raw.clients) ? raw.clients[0] : raw.clients;
  if (!client) return { ok: false, reason: "invalid" };

  const row: OnboardingTokenRow = {
    id: raw.id,
    client_id: raw.client_id,
    token: raw.token,
    expires_at: raw.expires_at,
    used: raw.used,
  };
  return {
    ok: true,
    row: {
      id: row.id,
      client_id: row.client_id,
      token: row.token,
      expires_at: row.expires_at,
      used: row.used,
    },
    client: {
      id: client.id,
      mode: client.mode === "solo" ? "solo" : "team",
      plan: client.plan ?? "starter",
      owner_email: client.owner_email,
      setup_status: client.setup_status,
      onboarding_progress: (client.onboarding_progress as Record<string, unknown>) ?? {},
    },
  };
}

export function onboardingLink(token: string): string {
  const siteUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${siteUrl}/onboard/${token}`;
}

export async function renewOnboardingToken(oldToken: string): Promise<
  | { ok: true; renewed: boolean; token: string; link: string; emailSent: boolean }
  | { ok: false; error: string; status: number }
> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("client_onboarding_tokens")
    .select("id, client_id, token, expires_at, used, clients(owner_email, setup_status)")
    .eq("token", oldToken)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Invalid onboarding link", status: 404 };
  }

  const typed = existing as {
    id: string;
    client_id: string;
    token: string;
    expires_at: string;
    used: boolean;
    clients:
      | { owner_email: string | null; setup_status: string }
      | { owner_email: string | null; setup_status: string }[]
      | null;
  };

  const clientRow = Array.isArray(typed.clients) ? typed.clients[0] : typed.clients;

  if (typed.used) {
    return { ok: false, error: "This onboarding link has already been used", status: 400 };
  }

  if (clientRow?.setup_status === "active") {
    return { ok: false, error: "This client has already completed setup", status: 400 };
  }

  const ownerEmail = clientRow?.owner_email;
  if (!ownerEmail) {
    return { ok: false, error: "No owner email on file — contact your agency", status: 400 };
  }

  const now = new Date();
  const expiresAt = new Date(typed.expires_at);
  const isExpired = expiresAt < now;

  if (!isExpired) {
    const renewWindow = new Date(now.getTime() + ONBOARDING_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const justRenewed = expiresAt.getTime() > renewWindow.getTime() - ONBOARDING_TOKEN_RENEW_COOLDOWN_MS;
    if (justRenewed) {
      return {
        ok: false,
        error: "A new link was just sent. Please check your email.",
        status: 429,
      };
    }
    return {
      ok: true,
      renewed: false,
      token: typed.token,
      link: onboardingLink(typed.token),
      emailSent: false,
    };
  }

  const { token: newToken } = await createOnboardingToken(typed.client_id);
  const link = onboardingLink(newToken);

  const { onboardingLinkEmail } = await import("@/lib/email/templates/onboarding-link");
  const { sendEmail } = await import("@/lib/email/resend"); // dynamic to avoid circular deps
  const { subject, html } = onboardingLinkEmail({ link, expiresInDays: ONBOARDING_TOKEN_TTL_DAYS });
  const emailResult = await sendEmail({ to: ownerEmail, subject, html });

  return {
    ok: true,
    renewed: true,
    token: newToken,
    link,
    emailSent: emailResult.success,
  };
}
