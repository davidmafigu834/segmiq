import { Resend } from "resend";
import { logMessage, type LogMessageParams, type SendResult } from "@/lib/messaging/log";

type EmailAddress = string | { email: string; name?: string };

export type EmailPayload = {
  to: EmailAddress | EmailAddress[];
  from: EmailAddress;
  subject: string;
  html?: string;
  text?: string;
};

export type SendEmailWithLogParams = {
  mail: EmailPayload;
  context: Omit<LogMessageParams, "channel" | "recipient" | "templateKey" | "payloadPreview"> & {
    recipientOverride?: string;
  };
  payloadPreview?: string | null;
};

export async function sendEmailWithLog(params: SendEmailWithLogParams): Promise<SendResult & { channel: "email" }> {
  const { simulatedExternalSend } = await import("@/lib/demo/external");
  const simulated = await simulatedExternalSend(params.context.clientId);
  if (simulated) return { ...simulated, channel: "email" };
  const to = Array.isArray(params.mail.to) ? params.mail.to[0] : params.mail.to;
  const toEmail = typeof to === "string" ? to : to?.email;
  const recipient =
    params.context.recipientOverride || (typeof toEmail === "string" ? toEmail : "") || "";

  const baseLog: LogMessageParams = {
    userId: params.context.userId,
    leadId: params.context.leadId,
    clientId: params.context.clientId,
    channel: "email",
    notificationType: params.context.notificationType,
    recipient: recipient || "(unknown)",
    templateKey: null,
    payloadPreview:
      (params.payloadPreview ?? (typeof params.mail.text === "string" ? params.mail.text : null))?.slice(0, 500) ??
      null,
  };

  if (!recipient.trim()) {
    const result: SendResult = { ok: false, error: "No email recipient", errorCode: "SKIPPED_NO_EMAIL" };
    await logMessage(result, baseLog);
    return { ...result, channel: "email" };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    const result: SendResult = { ok: false, error: "Resend not configured", errorCode: "NO_RESEND" };
    await logMessage(result, baseLog);
    return { ...result, channel: "email" };
  }

  try {
    const resend = new Resend(key);
    const payload = {
      from: typeof params.mail.from === "string" ? params.mail.from : params.mail.from.email,
      to: Array.isArray(params.mail.to)
        ? params.mail.to.map((addr) => (typeof addr === "string" ? addr : addr.email))
        : typeof params.mail.to === "string"
          ? params.mail.to
          : params.mail.to.email,
      subject: params.mail.subject,
      text: typeof params.mail.text === "string" ? params.mail.text : "",
      ...(typeof params.mail.html === "string" ? { html: params.mail.html } : {}),
    };
    const response = await resend.emails.send(payload);
    if (response.error) {
      const result: SendResult = {
        ok: false,
        error: response.error.message || "Resend send failed",
        errorCode: response.error.name ?? "RESEND_ERROR",
      };
      await logMessage(result, baseLog);
      return { ...result, channel: "email" };
    }
    const result: SendResult = { ok: true, providerId: response.data?.id };
    await logMessage(result, baseLog);
    return { ...result, channel: "email" };
  } catch (err: unknown) {
    const e = err as { message?: string; code?: number };
    const result: SendResult = {
      ok: false,
      error: e.message || "Resend send failed",
      errorCode: e.code,
    };
    await logMessage(result, baseLog);
    return { ...result, channel: "email" };
  }
}
