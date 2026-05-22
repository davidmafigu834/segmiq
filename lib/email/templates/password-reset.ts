export function passwordResetEmail({
  userName,
  resetUrl,
  expiresInMinutes = 60,
}: {
  userName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}): { subject: string; html: string } {
  const subject = 'Reset your Leadstaq password';

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
                Leadstaq
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">

              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">
                Password reset
              </p>

              <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#09090b;line-height:1.2;">
                Reset your password,<br />${userName}
              </h1>

              <p style="margin:0 0 24px;font-size:15px;color:#3f3f46;line-height:1.6;">
                We received a request to reset the password for your Leadstaq account.
                Click the button below to choose a new password.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#09090b;border-radius:10px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#D4FF4F;text-decoration:none;letter-spacing:-0.1px;">
                      Reset password →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:14px;color:#71717a;line-height:1.6;">
                This link expires in ${expiresInMinutes} minutes. If you did not request a password reset,
                you can safely ignore this email — your password will not change.
              </p>

              <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.6;">
                If the button does not work, copy and paste this link into your browser:<br />
                <span style="color:#3f3f46;word-break:break-all;">${resetUrl}</span>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Leadstaq · If you need help contact your administrator.
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
