// Stuck-PENDING recovery email. Sent by the daily cron at
// /api/cron/stuck-pending-recovery to agencies whose photos uploaded
// but never got processed.
//
// Deliberately short and operational, not marketing. The customer
// uploaded photos, saw "DONE," and walked away because the auto-QC
// trigger silently hit a 402 (no credits / no payment method) or
// the queue dropped them. This email gets them back.

export const STUCK_RECOVERY_SUBJECT =
  "Your photos are uploaded but waiting on QC";

interface StuckPropertySummary {
  id: string;
  address: string;
  pendingCount: number;
}

interface Args {
  recipientName?: string | null;
  unsubscribeUrl: string;
  siteUrl?: string;
  properties: StuckPropertySummary[];
  // Free-form one-line reason from the cron, e.g. "no credits" or
  // "no payment method on file" or "stuck > 24 hours". Surfaces the
  // exact remediation step.
  blocker: string;
}

const SITE_URL_DEFAULT = "https://www.autoqc.io";

const MAILING_ADDRESS =
  process.env.ANNOUNCEMENT_MAILING_ADDRESS ?? "AutoQC · add mailing address";

export function renderStuckRecoveryEmail({
  recipientName,
  unsubscribeUrl,
  siteUrl = SITE_URL_DEFAULT,
  properties,
  blocker,
}: Args): { html: string; text: string } {
  const firstName = (recipientName ?? "").split(" ")[0] || "there";
  const totalPhotos = properties.reduce((n, p) => n + p.pendingCount, 0);
  const propWord = properties.length === 1 ? "property" : "properties";

  const propRowsHtml = properties
    .map(
      (p) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <a href="${siteUrl}/dashboard/properties/${p.id}" style="color:#e7ecef;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(p.address)}</a>
                  <div style="font-family:'Courier New',monospace;font-size:11px;color:#a5b0b8;margin-top:2px;">
                    ${p.pendingCount} photo${p.pendingCount === 1 ? "" : "s"} waiting
                  </div>
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;">
                  <a href="${siteUrl}/dashboard/properties/${p.id}" style="display:inline-block;background:#55f19a;color:#07090c;padding:8px 14px;border-radius:8px;font-weight:600;text-decoration:none;font-size:12px;letter-spacing:0.01em;">
                    Resume &rarr;
                  </a>
                </td>
              </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Photos waiting on QC</title>
  </head>
  <body style="margin:0;padding:0;background:#07090c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e7ecef;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${totalPhotos} photos uploaded but stuck waiting for QC. ${escapeHtml(blocker)}.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#07090c;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">

            <tr>
              <td style="padding:0 0 24px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="background:#55f19a;border-radius:8px;padding:6px 8px;vertical-align:middle;">
                      <div style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#07090c;letter-spacing:0.04em;">AQC</div>
                    </td>
                    <td style="padding-left:10px;vertical-align:middle;">
                      <div style="font-size:16px;font-weight:600;color:#e7ecef;letter-spacing:-0.01em;">AutoQC</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:linear-gradient(140deg,#0d1117 0%,#1a1208 50%,#0d1117 100%);border:1px solid rgba(255,180,80,0.30);border-radius:18px;padding:28px 28px;">
                <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#fbbf24;margin-bottom:10px;">
                  Photos waiting on QC
                </div>
                <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.2;letter-spacing:-0.02em;font-weight:700;color:#f5f7f9;">
                  Hey ${escapeHtml(firstName)}, your upload finished but QC didn't run.
                </h1>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#b3bcc4;">
                  ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"} across ${properties.length} ${propWord} are sitting in PENDING. Reason: ${escapeHtml(blocker)}. Click any property below to fix the blocker and run QC.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 0 0 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d1117;border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;">
                  ${propRowsHtml}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 0 0 0;">
                <p style="margin:0;font-size:13px;line-height:1.65;color:#a5b0b8;">
                  Hit reply if something is broken. We send this email at most once every few days, and only when photos have been waiting longer than 24 hours.
                </p>
                <p style="margin:14px 0 0 0;font-size:13px;color:#a5b0b8;">
                  Paul, founder
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:36px 0 0 0;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:18px 0 8px 0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6a7682;">
                  Why you are getting this
                </p>
                <p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;color:#6a7682;">
                  This is a transactional notification about photos in your AutoQC account that need attention. Once your queue is empty, these emails stop.
                </p>
                <p style="margin:0 0 10px 0;font-size:12px;color:#6a7682;">
                  <a href="${unsubscribeUrl}" style="color:#a5b0b8;text-decoration:underline;">Unsubscribe from product updates</a>
                </p>
                <p style="margin:16px 0 0 0;font-size:11px;color:#4b5560;">
                  ${escapeHtml(MAILING_ADDRESS)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const propLines = properties
    .map(
      (p) =>
        `  - ${p.address} (${p.pendingCount} photo${p.pendingCount === 1 ? "" : "s"})\n    ${siteUrl}/dashboard/properties/${p.id}`,
    )
    .join("\n");

  const text = `Hey ${firstName},

Your upload finished but QC did not run on ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"}
across ${properties.length} ${propWord}. Reason: ${blocker}.

Click any of these to fix the blocker and resume:

${propLines}

Hit reply if something is broken.

Paul, founder

Unsubscribe: ${unsubscribeUrl}

${MAILING_ADDRESS}
`;

  return { html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c),
  );
}
