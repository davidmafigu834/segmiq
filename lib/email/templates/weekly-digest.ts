export function weeklyDigestEmail({
  managerName,
  clientName,
  weekRange,
  stats,
  teamRows,
  topLead,
}: {
  managerName: string;
  clientName: string;
  weekRange: string;
  stats: {
    leadsReceived: number;
    leadsContacted: number;
    contactRate: number;
    dealsWon: number;
    dealsLost: number;
    avgResponseHours: number;
  };
  teamRows: Array<{
    name: string;
    assigned: number;
    contacted: number;
    won: number;
    lost: number;
  }>;
  topLead?: {
    name: string;
    salesperson: string;
    dealValue?: number;
  } | null;
}): { subject: string; html: string } {
  const subject = `Weekly report — ${clientName} — ${weekRange}`;

  const teamRowsHtml = teamRows
    .map(
      (row) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#3f3f46;">
        ${row.name}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#3f3f46;text-align:center;">
        ${row.assigned}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#3f3f46;text-align:center;">
        ${row.contacted}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#3f3f46;text-align:center;">
        ${row.won}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:${row.lost > 0 ? "#ef4444" : "#3f3f46"};text-align:center;">
        ${row.lost}
      </td>
    </tr>
  `
    )
    .join("");

  const kpis = [
    { label: "Leads received", value: String(stats.leadsReceived), suffix: "" },
    { label: "Contact rate", value: String(stats.contactRate), suffix: "%" },
    { label: "Deals won", value: String(stats.dealsWon), suffix: "" },
    { label: "Avg response", value: String(stats.avgResponseHours), suffix: "h" },
  ];

  const kpiCells = kpis
    .map(
      (kpi) => `
    <td style="width:25%;text-align:center;padding:0 8px;">
      <div style="background:#f4f4f5;border-radius:12px;padding:16px 8px;">
        <p style="margin:0 0 4px;font-size:26px;font-weight:700;color:#09090b;">
          ${kpi.value}${kpi.suffix}
        </p>
        <p style="margin:0;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">
          ${kpi.label}
        </p>
      </div>
    </td>
  `
    )
    .join("");

  const teamSection =
    teamRows.length > 0
      ? `
    <tr>
      <td style="padding:28px 40px 0;">
        <p style="margin:0 0 16px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;">
          Team breakdown
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <th style="text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;padding-bottom:8px;">Name</th>
            <th style="text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;padding-bottom:8px;">Assigned</th>
            <th style="text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;padding-bottom:8px;">Contacted</th>
            <th style="text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;padding-bottom:8px;">Won</th>
            <th style="text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;padding-bottom:8px;">Lost</th>
          </tr>
          ${teamRowsHtml}
        </table>
      </td>
    </tr>`
      : "";

  const topLeadSection = topLead
    ? `
    <tr>
      <td style="padding:24px 40px 0;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#16a34a;">
            Deal won this week
          </p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#09090b;">
            ${topLead.name}
            ${topLead.dealValue ? `<span style="font-size:14px;color:#16a34a;font-weight:600;"> · $${topLead.dealValue.toLocaleString()}</span>` : ""}
          </p>
          <p style="margin:4px 0 0;font-size:13px;color:#71717a;">
            Closed by ${topLead.salesperson}
          </p>
        </div>
      </td>
    </tr>`
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
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">

          <tr>
            <td style="background:#000000;padding:32px 40px;">
              <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#D4FF4F;">Leadstaq</p>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);">Weekly performance report</p>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 40px 0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">
                Week of ${weekRange}
              </p>
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#09090b;line-height:1.2;">
                ${clientName}
              </h1>
              <p style="margin:0;font-size:14px;color:#71717a;">
                Hi ${managerName}, here is your weekly summary.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>${kpiCells}</tr>
              </table>
            </td>
          </tr>

          ${teamSection}
          ${topLeadSection}

          <tr>
            <td style="padding:32px 40px;border-top:1px solid #f4f4f5;margin-top:28px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Leadstaq · Automated weekly report for ${clientName}.
                Sent every Monday morning.
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
