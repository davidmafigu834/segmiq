export function proposalLinkEmail({
  link,
  recipientName,
  companyName,
  proposalTitle,
  validUntil,
}: {
  link: string;
  recipientName?: string | null;
  companyName?: string | null;
  proposalTitle: string;
  validUntil?: string | null;
}): { subject: string; html: string } {
  const who = recipientName?.trim() || companyName?.trim() || "there";
  const subject = `Your Segmiq proposal — ${proposalTitle}`;
  const validLine = validUntil
    ? `<p style="margin:24px 0 0;font-size:13px;color:#71717a;line-height:1.6;">This proposal is valid until ${escapeHtml(validUntil)}.</p>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:#000000;padding:32px 40px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#D4FF4F;letter-spacing:-0.3px;">Segmiq</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">
                Proposal
              </p>
              <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#09090b;line-height:1.2;">
                ${escapeHtml(proposalTitle)}
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#3f3f46;line-height:1.6;">
                Hi ${escapeHtml(who)}, we have prepared a proposal for ${escapeHtml(companyName?.trim() || "you")}.
                Open it below to review the details, pricing, and to accept or decline.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#D4FF4F;border-radius:10px;">
                    <a href="${escapeHtml(link)}"
                       style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#000000;text-decoration:none;letter-spacing:-0.1px;">
                      View your proposal &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              ${validLine}
              <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.6;word-break:break-all;">
                Or copy this URL:<br />
                <span style="color:#52525b;">${escapeHtml(link)}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                If you were not expecting this proposal, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
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
