/** Internal staff notification when a prospect accepts or rejects a proposal. */
export function proposalResponseEmail({
  action,
  proposalNumber,
  proposalTitle,
  companyName,
  recipientName,
  total,
  dashboardUrl,
  provisioned,
}: {
  action: "accepted" | "rejected";
  proposalNumber: string;
  proposalTitle: string;
  companyName?: string | null;
  recipientName?: string | null;
  total?: string | null;
  dashboardUrl: string;
  provisioned?: boolean;
}): { subject: string; html: string } {
  const verb = action === "accepted" ? "accepted" : "declined";
  const who = companyName?.trim() || recipientName?.trim() || "A prospect";
  const subject = `Proposal ${proposalNumber} ${verb} — ${who}`;
  const provisionLine =
    action === "accepted" && provisioned
      ? `<p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">A pending client and draft subscription were created automatically. Finish onboarding from the dashboard.</p>`
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="background:#000000;padding:24px 32px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#D4FF4F;">Segmiq</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#09090b;line-height:1.25;">
            ${escapeHtml(who)} ${verb} your proposal
          </h1>
          <p style="margin:0 0 8px;font-size:14px;color:#3f3f46;line-height:1.6;">
            <strong>${escapeHtml(proposalNumber)}</strong> — ${escapeHtml(proposalTitle)}
            ${total ? ` · ${escapeHtml(total)}` : ""}
          </p>
          ${recipientName ? `<p style="margin:0 0 16px;font-size:13px;color:#71717a;">Contact: ${escapeHtml(recipientName)}</p>` : ""}
          ${provisionLine}
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#D4FF4F;border-radius:10px;">
              <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#000000;text-decoration:none;">
                Open dashboard &rarr;
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;

  return { subject, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
