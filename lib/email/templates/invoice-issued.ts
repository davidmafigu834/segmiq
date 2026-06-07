export function invoiceIssuedEmail({
  clientName,
  invoiceNumber,
  planLabel,
  amountFormatted,
  dueDate,
  period,
  invoiceUrl,
}: {
  clientName: string;
  invoiceNumber: string;
  planLabel: string;
  amountFormatted: string;
  dueDate: string;
  period: string;
  invoiceUrl: string | null;
}): { subject: string; html: string } {
  const subject = `Invoice ${invoiceNumber} from Segmiq — ${amountFormatted}`;

  const ctaBlock = invoiceUrl
    ? `
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#09090b;border-radius:10px;">
                    <a href="${escapeHtml(invoiceUrl)}"
                       style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#D4FF4F;text-decoration:none;letter-spacing:-0.1px;">
                      View invoice PDF &rarr;
                    </a>
                  </td>
                </tr>
              </table>`
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

          <!-- Header -->
          <tr>
            <td style="background:#000000;padding:32px 40px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#D4FF4F;letter-spacing:-0.3px;">
                Segmiq
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">
                New invoice
              </p>

              <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#09090b;line-height:1.2;">
                Invoice ${escapeHtml(invoiceNumber)}
              </h1>

              <p style="margin:0 0 24px;font-size:15px;color:#3f3f46;line-height:1.6;">
                Hi <strong>${escapeHtml(clientName)}</strong>, here is your invoice for
                <strong>Segmiq CRM — ${escapeHtml(planLabel)} plan</strong>. The PDF is attached to this email.
              </p>

              <!-- Summary box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:12px;padding:24px;margin-bottom:28px;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;">Amount due</p>
                    <p style="margin:0 0 20px;font-size:22px;color:#09090b;font-weight:700;">${escapeHtml(amountFormatted)}</p>
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;">Service period</p>
                    <p style="margin:0 0 20px;font-size:14px;color:#09090b;font-weight:500;">${escapeHtml(period)}</p>
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;">Due date</p>
                    <p style="margin:0;font-size:14px;color:#09090b;font-weight:500;">${escapeHtml(dueDate)}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                Payment details (bank transfer / mobile money) are included on the attached invoice.
                Please reference <strong>${escapeHtml(invoiceNumber)}</strong> when you pay.
              </p>
${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                This invoice was sent by Segmiq. If you have any questions about your billing, just reply to this email.
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

function escapeHtml(str: string | null | undefined): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
