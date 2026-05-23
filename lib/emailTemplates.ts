import { getPublicBaseUrl } from "@/lib/constants";
import { normalizeToE164 } from "@/lib/phone-validate";
import type { LeadRow } from "@/types";

type Person = { name: string };
type Client = { name: string };

export function renderManagerNewLeadEmail({
  lead,
  salesperson,
  client,
}: {
  lead: LeadRow;
  salesperson: Person;
  client: Client;
}): string {
  const dashboardUrl = `${getPublicBaseUrl()}/client/dashboard`;
  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, 'Segoe UI', sans-serif; background: #FAFAF7; margin: 0; padding: 32px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E6DF; border-radius: 10px; padding: 32px;">
    <tr>
      <td>
        <div style="font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #9498A1; margin-bottom: 8px;">
          ${escapeHtml(client.name)} · New lead
        </div>
        <h1 style="font-family: 'Georgia', serif; font-size: 24px; color: #0A0B0D; margin: 0 0 24px; font-weight: 400;">
          New lead assigned to ${escapeHtml(salesperson.name)}
        </h1>
        <p style="font-size: 14px; color: #5A5E68; line-height: 1.6; margin: 0 0 24px;">
          A new lead has entered your pipeline. Your team will follow up shortly.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #E8E6DF; padding-top: 20px;">
          <tr>
            <td style="font-size: 12px; color: #9498A1; padding-bottom: 4px;">Lead name</td>
            <td style="font-size: 12px; color: #9498A1; padding-bottom: 4px;">Source</td>
          </tr>
          <tr>
            <td style="font-size: 14px; color: #0A0B0D; padding-bottom: 16px;">${escapeHtml(lead.name)}</td>
            <td style="font-size: 14px; color: #0A0B0D; padding-bottom: 16px;">${formatSource(lead.source)}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #9498A1; padding-bottom: 4px;">Assigned to</td>
            <td style="font-size: 12px; color: #9498A1; padding-bottom: 4px;">Received</td>
          </tr>
          <tr>
            <td style="font-size: 14px; color: #0A0B0D;">${escapeHtml(salesperson.name)}</td>
            <td style="font-size: 14px; color: #0A0B0D;">${formatDate(lead.created_at)}</td>
          </tr>
        </table>
        <div style="margin-top: 32px;">
          <a href="${dashboardUrl}" style="display: inline-block; background: #0A0B0D; color: #D4FF4F; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;">
            View pipeline →
          </a>
        </div>
        <p style="font-size: 11px; color: #9498A1; margin-top: 32px; border-top: 1px solid #E8E6DF; padding-top: 16px;">
          You're receiving this as the manager for ${escapeHtml(client.name)}.<br />
          Leadstaq · Lead management for ${escapeHtml(client.name)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function renderManagerDealWonEmail({
  lead,
  salesperson,
  client,
}: {
  lead: LeadRow;
  salesperson: Person;
  client: Client;
}): string {
  const dashboardUrl = `${getPublicBaseUrl()}/client/dashboard`;
  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, 'Segoe UI', sans-serif; background: #FAFAF7; margin: 0; padding: 32px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E6DF; border-radius: 10px; padding: 32px;">
    <tr>
      <td>
        <div style="font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #D4FF4F; background: #0A0B0D; display: inline-block; padding: 4px 10px; border-radius: 4px; margin-bottom: 16px;">
          Deal Won
        </div>
        <h1 style="font-family: 'Georgia', serif; font-size: 28px; color: #0A0B0D; margin: 0 0 8px; font-weight: 400;">
          ${formatCurrency(lead.deal_value)}
        </h1>
        <p style="font-size: 15px; color: #5A5E68; margin: 0 0 24px;">
          <strong style="color: #0A0B0D;">${escapeHtml(salesperson.name)}</strong> closed <strong style="color: #0A0B0D;">${escapeHtml(lead.name)}</strong>.
        </p>
        <p style="font-size: 13px; color: #5A5E68; line-height: 1.6; margin: 0 0 32px;">
          Great news from your pipeline. Check the dashboard for the full details.
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; background: #0A0B0D; color: #D4FF4F; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;">
          View dashboard →
        </a>
        <p style="font-size: 11px; color: #9498A1; margin-top: 32px; border-top: 1px solid #E8E6DF; padding-top: 16px;">
          You're receiving this as the manager for ${escapeHtml(client.name)}.<br />
          Leadstaq · ${escapeHtml(client.name)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function renderManagerUncontactedLeadEmail({
  lead,
  client,
  hoursUncontacted,
  salespersonName,
  slaHours,
  salespersonEmail,
  salespersonPhone,
}: {
  /** Only `id` and `name` are used by this template. */
  lead: Pick<LeadRow, "id" | "name">;
  client: { name: string };
  hoursUncontacted: number;
  salespersonName: string;
  slaHours: number;
  salespersonEmail?: string | null;
  salespersonPhone?: string | null;
}): string {
  const pipelineUrl = `${getPublicBaseUrl()}/client/leads?lead=${encodeURIComponent(lead.id)}`;
  const e164 = salespersonPhone?.trim()
    ? normalizeToE164(salespersonPhone.trim(), process.env.DEFAULT_COUNTRY_CODE || "US")
    : null;
  const contactRepHref = e164
    ? `sms:${e164.replace(/[^\d+]/g, "")}`
    : salespersonEmail?.trim()
      ? `mailto:${salespersonEmail.trim()}`
      : `mailto:?subject=${encodeURIComponent(`Follow up on lead: ${lead.name ?? "Lead"}`)}`;
  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, 'Segoe UI', sans-serif; background: #FAFAF7; margin: 0; padding: 32px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E6DF; border-radius: 10px; padding: 32px;">
    <tr>
      <td>
        <div style="font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #92400E; background: #FEF3C7; display: inline-block; padding: 4px 10px; border-radius: 4px; margin-bottom: 16px;">
          Uncontacted
        </div>
        <h1 style="font-family: 'Georgia', serif; font-size: 24px; color: #0A0B0D; margin: 0 0 16px; font-weight: 400;">
          Lead going cold
        </h1>
        <p style="font-size: 14px; color: #5A5E68; line-height: 1.6; margin: 0 0 24px;">
          <strong style="color: #0A0B0D;">${escapeHtml(lead.name)}</strong> hasn&apos;t been called by
          <strong style="color: #0A0B0D;">${escapeHtml(salespersonName)}</strong> in
          <strong style="color: #0A0B0D;">${hoursUncontacted}</strong> hours.
          Your response SLA is <strong style="color: #0A0B0D;">${slaHours}h</strong>.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
          <tr>
            <td style="padding-right: 8px; vertical-align: top;">
              <a href="${pipelineUrl}" style="display: inline-block; background: #0A0B0D; color: #D4FF4F; text-decoration: none; padding: 12px 16px; border-radius: 6px; font-size: 13px; font-weight: 500;">
                View pipeline →
              </a>
            </td>
            <td style="padding-left: 8px; vertical-align: top;">
              <a href="${escapeHtml(contactRepHref)}" style="display: inline-block; border: 1px solid #E8E6DF; color: #0A0B0D; text-decoration: none; padding: 12px 16px; border-radius: 6px; font-size: 13px; font-weight: 500;">
                Contact ${escapeHtml(salespersonName)} →
              </a>
            </td>
          </tr>
        </table>
        <p style="font-size: 11px; color: #9498A1; margin-top: 32px; border-top: 1px solid #E8E6DF; padding-top: 16px;">
          ${escapeHtml(client.name)} · Leadstaq
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function escapeHtml(str: string | null | undefined): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatSource(source: string): string {
  if (source === "FACEBOOK") return "Facebook Lead Ad";
  if (source === "LANDING_PAGE") return "Landing page";
  if (source === "MANUAL") return "Manual entry";
  if (source === "REFERRAL") return "Referral";
  return source;
}

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDate(d: Date | string): string {
  const date = new Date(d);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
