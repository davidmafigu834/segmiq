"use server";

import { createSubmission, type SubmissionType } from "@/lib/marketing-submissions";
import { sendEmail } from "@/lib/email/resend";

export type SubmitResult = { ok: boolean; error?: string };

const TYPES: SubmissionType[] = ["demo", "contact", "partner", "career"];

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function submitMarketingForm(_prev: SubmitResult | null, formData: FormData): Promise<SubmitResult> {
  const type = (str(formData, "type") || "demo") as SubmissionType;
  const name = str(formData, "name");
  const email = str(formData, "email");

  if (str(formData, "company_url")) return { ok: true };

  if (!TYPES.includes(type)) return { ok: false, error: "Invalid form type." };
  if (!name) return { ok: false, error: "Please add your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Please add a valid email." };

  const input = {
    type,
    name,
    email,
    phone: str(formData, "phone"),
    company: str(formData, "company"),
    market: str(formData, "market"),
    industry: str(formData, "industry"),
    teamSize: str(formData, "teamSize"),
    leadVolume: str(formData, "leadVolume"),
    role: str(formData, "role"),
    message: str(formData, "message"),
    source: str(formData, "source"),
  };

  try {
    await createSubmission(input);
  } catch (e) {
    console.error("createSubmission failed", e);
    return { ok: false, error: "Something went wrong saving your request. Please try again." };
  }

  const inbox = process.env.MARKETING_INBOX_EMAIL || "sales@segmiq.com";
  const lines = [
    `Type: ${type}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `WhatsApp: ${input.phone}`,
    `Company: ${input.company}`,
    `Market: ${input.market}`,
    `Industry: ${input.industry}`,
    `Team size: ${input.teamSize}`,
    `Leads/month: ${input.leadVolume}`,
    input.role ? `Role: ${input.role}` : "",
    `Source: ${input.source}`,
    "",
    "Message:",
    input.message,
  ].filter(Boolean);

  const html = `<pre style="font-family:monospace;font-size:13px">${lines.map(escapeHtml).join("\n")}</pre>`;

  try {
    await sendEmail({
      to: inbox,
      subject: `New ${type} request — ${name}${input.company ? " · " + input.company : ""}`,
      html,
    });
  } catch (e) {
    console.error("notification email failed", e);
  }

  return { ok: true };
}
