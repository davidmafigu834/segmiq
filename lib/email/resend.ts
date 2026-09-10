import { Resend } from "resend";

export type EmailAttachment = {
  filename: string;
  /** Raw file bytes. Resend accepts a Buffer here. */
  content: Buffer;
};

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    if (!resend) {
      return { success: false, error: "RESEND_API_KEY not configured" };
    }
    const from = process.env.RESEND_FROM_EMAIL;
    if (!from) {
      return { success: false, error: "RESEND_FROM_EMAIL not configured" };
    }
    await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });
    return { success: true };
  } catch (error) {
    console.error("Resend email error:", error);
    return { success: false, error: String(error) };
  }
}
