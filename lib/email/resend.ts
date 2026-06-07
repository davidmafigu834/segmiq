import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export type EmailAttachment = {
  filename: string;
  /** Raw file bytes. Resend accepts a Buffer here. */
  content: Buffer;
};

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
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
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
