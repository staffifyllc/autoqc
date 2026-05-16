// Daily triage digest sent to Paul. Aggregates every NEW BugReport
// (regardless of age — old NEW reports bubble up by their age column),
// plus health-state counters (stuck PENDING photos, processing
// properties that have been processing too long).
//
// Internal-only email. No unsubscribe footer, no marketing wrapper.
// Optimized for a 7am scan: scannable cards, one suggested action per
// bug, deep links into /dashboard/admin/bugs.

export interface TriageBug {
  id: string;
  title: string;
  description: string;
  severity: string; // LOW | NORMAL | HIGH | CRITICAL
  type: string;    // BUG | FEATURE_REQUEST | etc
  ageDays: number;
  reporterEmail: string;
  reporterName: string | null;
  agencyName: string | null;
  pageUrl: string | null;
  propertyAddress: string | null;
  propertyPhotoCount: number | null;
  propertyStuckCount: number | null;
  suggestedAction: string;
  suggestedActionTone: "urgent" | "aging" | "normal" | "low";
}

export interface TriageHealth {
  stuckPendingPhotos: number;
  stuckProcessingProperties: number;
  agenciesWithStuckOver24h: number;
}

const SITE = "https://www.autoqc.io";

export function triageSubject(args: {
  bugCount: number;
  stuckPhotoCount: number;
}): string {
  const parts = [];
  if (args.bugCount > 0) {
    parts.push(`${args.bugCount} open bug${args.bugCount !== 1 ? "s" : ""}`);
  }
  if (args.stuckPhotoCount > 0) {
    parts.push(
      `${args.stuckPhotoCount} stuck photo${args.stuckPhotoCount !== 1 ? "s" : ""}`,
    );
  }
  const tail = parts.length > 0 ? parts.join(", ") : "all clear";
  return `AutoQC daily triage: ${tail}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c),
  );
}

function severityColor(severity: string): { fg: string; bg: string } {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return { fg: "#fca5a5", bg: "rgba(239,68,68,0.18)" };
    case "HIGH":
      return { fg: "#fdba74", bg: "rgba(249,115,22,0.16)" };
    case "NORMAL":
      return { fg: "#fde68a", bg: "rgba(250,204,21,0.14)" };
    default:
      return { fg: "#a5b0b8", bg: "rgba(255,255,255,0.06)" };
  }
}

function actionColor(tone: TriageBug["suggestedActionTone"]): string {
  if (tone === "urgent") return "#fca5a5";
  if (tone === "aging") return "#fdba74";
  if (tone === "low") return "#a5b0b8";
  return "#7dd3fc";
}

function renderBugCard(b: TriageBug): string {
  const sev = severityColor(b.severity);
  const ageLabel =
    b.ageDays < 1 ? "today" : `${Math.floor(b.ageDays)}d open`;
  const ageColor = b.ageDays >= 3 ? "#fdba74" : "#a5b0b8";

  return `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:14px;margin-bottom:14px;">
    <tr>
      <td style="padding:18px 20px 16px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              <span style="background:${sev.bg};color:${sev.fg};padding:3px 8px;border-radius:6px;font-family:'Courier New',monospace;font-size:10px;font-weight:700;letter-spacing:0.10em;">${escapeHtml(b.severity)}</span>
              <span style="margin-left:8px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.10em;color:#a5b0b8;">${escapeHtml(b.type)}</span>
            </td>
            <td align="right" style="vertical-align:middle;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.10em;color:${ageColor};text-transform:uppercase;">
              ${escapeHtml(ageLabel)}
            </td>
          </tr>
        </table>
        <p style="margin:10px 0 6px 0;font-size:15px;font-weight:600;color:#f5f7f9;line-height:1.3;">
          ${escapeHtml(b.title)}
        </p>
        <p style="margin:0 0 12px 0;font-size:13px;line-height:1.55;color:#a5b0b8;">
          ${escapeHtml(b.description.slice(0, 320))}${b.description.length > 320 ? "..." : ""}
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(255,255,255,0.03);border-radius:8px;font-size:12px;color:#a5b0b8;margin-bottom:12px;">
          <tr><td style="padding:8px 12px 4px 12px;"><strong style="color:#e7ecef;">From:</strong> ${escapeHtml(b.reporterEmail)}${b.reporterName ? ` (${escapeHtml(b.reporterName)})` : ""}${b.agencyName ? ` &middot; ${escapeHtml(b.agencyName)}` : ""}</td></tr>
          ${b.propertyAddress
            ? `<tr><td style="padding:0 12px 4px 12px;"><strong style="color:#e7ecef;">Property:</strong> ${escapeHtml(b.propertyAddress)}${b.propertyPhotoCount != null ? ` &middot; ${b.propertyPhotoCount} photo${b.propertyPhotoCount !== 1 ? "s" : ""}` : ""}${b.propertyStuckCount && b.propertyStuckCount > 0 ? ` &middot; <span style="color:#fdba74;">${b.propertyStuckCount} stuck</span>` : ""}</td></tr>`
            : ""}
          ${b.pageUrl
            ? `<tr><td style="padding:0 12px 8px 12px;"><strong style="color:#e7ecef;">URL:</strong> <a href="${escapeHtml(b.pageUrl)}" style="color:#7dd3fc;text-decoration:none;">${escapeHtml(b.pageUrl.slice(0, 80))}${b.pageUrl.length > 80 ? "..." : ""}</a></td></tr>`
            : ""}
        </table>
        <p style="margin:0;font-size:12px;line-height:1.5;color:${actionColor(b.suggestedActionTone)};">
          <strong style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#a5b0b8;">Next:</strong>
          ${escapeHtml(b.suggestedAction)}
        </p>
      </td>
    </tr>
  </table>`;
}

export function renderTriageEmail(args: {
  bugs: TriageBug[];
  health: TriageHealth;
  dateLabel: string;
}): { html: string; text: string } {
  const { bugs, health, dateLabel } = args;
  const allClear = bugs.length === 0 && health.stuckPendingPhotos === 0;

  const bugSection = bugs.length === 0
    ? `<p style="margin:0;padding:14px 18px;border:1px dashed rgba(85,241,154,0.40);border-radius:10px;font-size:13px;color:#55f19a;">No open bug reports. Nice.</p>`
    : bugs.map(renderBugCard).join("");

  const healthSection = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d1117;border:1px solid rgba(255,255,255,0.06);border-radius:14px;font-size:13px;">
      <tr>
        <td style="padding:14px 18px 8px 18px;">
          <p style="margin:0 0 8px 0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#a5b0b8;">Health counters</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding:6px 0;color:#e7ecef;">Photos stuck PENDING &gt; 24h</td>
              <td align="right" style="padding:6px 0;font-family:'Courier New',monospace;color:${health.stuckPendingPhotos > 0 ? "#fdba74" : "#a5b0b8"};font-weight:600;">${health.stuckPendingPhotos}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#e7ecef;">Properties stuck PROCESSING &gt; 1h</td>
              <td align="right" style="padding:6px 0;font-family:'Courier New',monospace;color:${health.stuckProcessingProperties > 0 ? "#fdba74" : "#a5b0b8"};font-weight:600;">${health.stuckProcessingProperties}</td>
            </tr>
            <tr>
              <td style="padding:6px 0 12px 0;color:#e7ecef;">Agencies needing recovery email</td>
              <td align="right" style="padding:6px 0 12px 0;font-family:'Courier New',monospace;color:${health.agenciesWithStuckOver24h > 0 ? "#fdba74" : "#a5b0b8"};font-weight:600;">${health.agenciesWithStuckOver24h}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AutoQC daily triage</title>
  </head>
  <body style="margin:0;padding:0;background:#07090c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e7ecef;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#07090c;">
      <tr>
        <td align="center" style="padding:36px 16px 56px 16px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;width:100%;">

            <tr>
              <td style="padding:0 0 8px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="background:#55f19a;border-radius:8px;padding:6px 8px;vertical-align:middle;">
                      <div style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#07090c;letter-spacing:0.04em;">AQC</div>
                    </td>
                    <td style="padding-left:10px;vertical-align:middle;">
                      <div style="font-size:14px;font-weight:600;color:#e7ecef;letter-spacing:-0.01em;">AutoQC triage</div>
                      <div style="font-family:'Courier New',monospace;font-size:11px;color:#6a7682;letter-spacing:0.08em;">${escapeHtml(dateLabel)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${allClear
              ? `<tr><td style="padding:24px 0 0 0;"><p style="margin:0;font-size:15px;line-height:1.65;color:#55f19a;">All clear. No open bugs, no stuck photos, no agencies needing recovery. Inbox zero on the system side.</p></td></tr>`
              : ""}

            ${bugs.length > 0 || !allClear ? `
            <tr>
              <td style="padding:24px 0 10px 0;">
                <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.20em;text-transform:uppercase;color:#55f19a;">Open bug reports</p>
                <p style="margin:4px 0 0 0;font-size:13px;color:#a5b0b8;">${bugs.length} report${bugs.length !== 1 ? "s" : ""} with status NEW</p>
              </td>
            </tr>
            <tr><td style="padding:0;">${bugSection}</td></tr>` : ""}

            <tr>
              <td style="padding:16px 0 0 0;">
                <p style="margin:0 0 10px 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.20em;text-transform:uppercase;color:#7dd3fc;">System health</p>
              </td>
            </tr>
            <tr><td style="padding:0 0 24px 0;">${healthSection}</td></tr>

            <tr>
              <td style="padding:24px 0 0 0;">
                <a href="${SITE}/dashboard/admin/bugs" style="display:inline-block;background:#0d1117;border:1px solid rgba(85,241,154,0.45);color:#55f19a;padding:11px 18px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.01em;">Open bug board &rarr;</a>
              </td>
            </tr>

            <tr>
              <td style="padding:30px 0 0 0;">
                <p style="margin:0;font-size:11px;line-height:1.55;color:#6a7682;">
                  Generated by /api/cron/bug-triage. Edit cadence in vercel.json, edit content in src/lib/announcements/bugTriage.ts.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // Plain text version
  const tlines: string[] = [];
  tlines.push(`AutoQC daily triage — ${dateLabel}`);
  tlines.push("");
  if (allClear) {
    tlines.push("All clear. No open bugs, no stuck photos.");
  } else {
    if (bugs.length > 0) {
      tlines.push(`OPEN BUGS (${bugs.length})`);
      for (const b of bugs) {
        const age = b.ageDays < 1 ? "today" : `${Math.floor(b.ageDays)}d open`;
        tlines.push("");
        tlines.push(`[${b.severity}] ${b.title}   (${age})`);
        tlines.push(`  from: ${b.reporterEmail}${b.agencyName ? ` @ ${b.agencyName}` : ""}`);
        tlines.push(`  ${b.description.slice(0, 240)}${b.description.length > 240 ? "..." : ""}`);
        if (b.propertyAddress) {
          tlines.push(`  property: ${b.propertyAddress}${b.propertyPhotoCount != null ? ` (${b.propertyPhotoCount} photos)` : ""}`);
        }
        tlines.push(`  next: ${b.suggestedAction}`);
      }
      tlines.push("");
    }
    tlines.push("SYSTEM HEALTH");
    tlines.push(`  photos stuck PENDING > 24h:        ${health.stuckPendingPhotos}`);
    tlines.push(`  properties stuck PROCESSING > 1h:  ${health.stuckProcessingProperties}`);
    tlines.push(`  agencies needing recovery email:   ${health.agenciesWithStuckOver24h}`);
  }
  tlines.push("");
  tlines.push(`Open bug board: ${SITE}/dashboard/admin/bugs`);
  const text = tlines.join("\n");

  return { html, text };
}
