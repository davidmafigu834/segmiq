export function paymentOverdueEmail({
  clientName,
  invoiceNumber,
  amountFormatted,
  daysUntilSuspension,
  billingUrl,
  isFinalWarning,
}: {
  clientName: string;
  invoiceNumber: string;
  amountFormatted: string;
  daysUntilSuspension: number;
  billingUrl: string | null;
  isFinalWarning?: boolean;
}): { subject: string; html: string } {
  const subject = isFinalWarning
    ? `Final reminder: invoice ${invoiceNumber} — account suspends in ${daysUntilSuspension} day${daysUntilSuspension === 1 ? "" : "s"}`
    : `Payment overdue: invoice ${invoiceNumber}`;

  const headline = isFinalWarning
    ? "Final payment reminder"
    : "Your invoice is overdue";

  const intro = isFinalWarning
    ? `Your Segmiq account will be suspended in <strong>${daysUntilSuspension} day${daysUntilSuspension === 1 ? "" : "s"}</strong> if invoice <strong>${escapeHtml(invoiceNumber)}</strong> (${escapeHtml(amountFormatted)}) remains unpaid.`
    : `Invoice <strong>${escapeHtml(invoiceNumber)}</strong> for <strong>${escapeHtml(amountFormatted)}</strong> is now overdue. Please settle it to keep your account active.`;

  const ctaBlock = billingUrl
    ? `
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#09090b;border-radius:10px;">
                    <a href="${escapeHtml(billingUrl)}"
                       style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#D4FF4F;text-decoration:none;letter-spacing:-0.1px;">
                      Pay now &rarr;
                    </a>
                  </td>
                </tr>
              </table>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="background:#000000;padding:32px 40px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#D4FF4F;">Segmiq</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Billing</p>
          <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#09090b;">${headline}</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#3f3f46;line-height:1.6;">
            Hi <strong>${escapeHtml(clientName)}</strong>, ${intro}
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
            Upload your proof of payment on the billing page once you have paid.
          </p>
${ctaBlock}
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #f4f4f5;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">This message was sent by Segmiq regarding your billing.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

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
