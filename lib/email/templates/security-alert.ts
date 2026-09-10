import { sendEmail } from "@/lib/email/resend";

/**
 * Security notification emails. Never include tokens, passwords, OTPs, or recovery codes.
 */

function baseEmail(opts: {
  title: string;
  eyebrow: string;
  bodyHtml: string;
}): { subject: string; html: string } {
  return {
    subject: opts.title,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="background:#000000;padding:32px 40px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#D4FF4F;letter-spacing:-0.3px;">Segmiq</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">${opts.eyebrow}</p>
          <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#09090b;line-height:1.25;">${opts.title}</h1>
          ${opts.bodyHtml}
          <p style="margin:28px 0 0;font-size:14px;color:#71717a;line-height:1.6;">
            If this was you, no action is needed. If you do not recognise this activity,
            change your password and sign out other devices from Security settings.
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #f4f4f5;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">Segmiq · Account security</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export async function sendSecurityNotification(opts: {
  to: string;
  kind:
    | "new_sign_in"
    | "password_changed"
    | "password_reset"
    | "mfa_enabled"
    | "mfa_disabled"
    | "recovery_code_used"
    | "sign_out_everywhere";
  deviceLabel?: string | null;
  whenLabel?: string | null;
}): Promise<void> {
  if (!opts.to?.trim()) return;

  const when = opts.whenLabel ?? new Date().toLocaleString("en-GB", { timeZone: "Africa/Harare" });
  const device = opts.deviceLabel ? `<p style="margin:0 0 8px;font-size:15px;color:#3f3f46;"><strong>${opts.deviceLabel}</strong></p>` : "";

  const copy: Record<typeof opts.kind, { title: string; eyebrow: string; lead: string }> = {
    new_sign_in: {
      title: "New sign-in to SegmiQ",
      eyebrow: "Security alert",
      lead: "A new session signed in to your SegmiQ account.",
    },
    password_changed: {
      title: "Your SegmiQ password was changed",
      eyebrow: "Security alert",
      lead: "The password on your SegmiQ account was changed.",
    },
    password_reset: {
      title: "Your SegmiQ password was reset",
      eyebrow: "Security alert",
      lead: "Your SegmiQ password was reset using a recovery link.",
    },
    mfa_enabled: {
      title: "Two-step verification enabled",
      eyebrow: "Security alert",
      lead: "Authenticator-based two-step verification is now on for your account.",
    },
    mfa_disabled: {
      title: "Two-step verification disabled",
      eyebrow: "Security alert",
      lead: "Two-step verification was turned off for your SegmiQ account.",
    },
    recovery_code_used: {
      title: "A recovery code was used",
      eyebrow: "Security alert",
      lead: "Someone signed in to your SegmiQ account using a recovery code.",
    },
    sign_out_everywhere: {
      title: "Signed out everywhere",
      eyebrow: "Security alert",
      lead: "All SegmiQ sessions for your account were signed out.",
    },
  };

  const c = copy[opts.kind];
  const { subject, html } = baseEmail({
    title: c.title,
    eyebrow: c.eyebrow,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${c.lead}</p>
      ${device}
      <p style="margin:0;font-size:14px;color:#71717a;">${when}</p>
    `,
  });

  try {
    await sendEmail({ to: opts.to, subject, html });
  } catch (err) {
    console.warn(
      "[security-email] send failed:",
      err instanceof Error ? err.message : "unknown"
    );
  }
}

/** Deduplicate new-sign-in emails for the same user+device within a window. */
const recentSignInMail = new Map<string, number>();
const SIGN_IN_MAIL_DEDUP_MS = 6 * 60 * 60 * 1000;

export function shouldSendNewSignInEmail(userId: string, deviceKey: string, nowMs = Date.now()): boolean {
  const key = `${userId}:${deviceKey}`;
  const prev = recentSignInMail.get(key);
  if (prev && nowMs - prev < SIGN_IN_MAIL_DEDUP_MS) return false;
  recentSignInMail.set(key, nowMs);
  return true;
}
