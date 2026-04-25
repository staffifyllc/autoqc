// Idle-user reactivation email. Targets people who signed up but
// never created a property. Frames the dashboard as invite-only and
// nudges them to log back in and lock in their access.
//
// Pairs with scripts/idle-reactivation-blast.ts.

export const LOCK_IN_ACCESS_SUBJECT =
  "Take your mornings back. Your AutoQC invite is still waiting.";

type Args = {
  recipientName?: string | null;
  unsubscribeUrl: string;
  siteUrl?: string;
};

const SITE_URL_DEFAULT = "https://www.autoqc.io";

const MAILING_ADDRESS =
  process.env.ANNOUNCEMENT_MAILING_ADDRESS ?? "AutoQC · add mailing address";

export function renderLockInAccessEmail({
  recipientName,
  unsubscribeUrl,
  siteUrl = SITE_URL_DEFAULT,
}: Args): { html: string; text: string } {
  const firstName = (recipientName ?? "").split(" ")[0] || "there";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your AutoQC invite is still waiting</title>
  </head>
  <body style="margin:0;padding:0;background:#07090c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e7ecef;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      You signed up for AutoQC but never ran your first property. Lock in your access before we close enrollment.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#07090c;">
      <tr>
        <td align="center" style="padding:32px 16px 16px 16px;">
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
              <td style="background:linear-gradient(140deg,#0d1117 0%,#111820 60%,#0d1117 100%);border:1px solid rgba(85,241,154,0.18);border-radius:20px;padding:40px 32px;">
                <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#55f19a;margin-bottom:14px;">
                  Invite-only · Action needed
                </div>
                <h1 style="margin:0 0 14px 0;font-size:32px;line-height:1.15;letter-spacing:-0.02em;font-weight:700;color:#f5f7f9;">
                  Take your mornings<br/>
                  <span style="background:linear-gradient(90deg,#55f19a 0%,#8df7b9 100%);-webkit-background-clip:text;background-clip:text;color:transparent;">back.</span>
                </h1>
                <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#a5b0b8;">
                  Hey ${escapeHtml(firstName)}, you signed up for AutoQC but
                  never ran your first property. We are still in invite-only
                  mode while we keep the platform tight, and your seat is being
                  held. Log back in this week to lock it in before we close
                  enrollment to the next round.
                </p>
                <div style="margin:0 0 18px 0;padding:18px 20px;background:rgba(85,241,154,0.06);border:1px solid rgba(85,241,154,0.22);border-radius:12px;">
                  <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#55f19a;margin-bottom:8px;">
                    A note from me, founder to operator
                  </div>
                  <p style="margin:0;font-size:15px;line-height:1.65;color:#e7ecef;">
                    When you signed up, I dropped <strong style="color:#55f19a;">5 free credits</strong>
                    in your account so you could try AutoQC without pulling out
                    a card. They are still sitting there waiting for you. And
                    in an effort to get to know one another, I would love to
                    offer you another <strong style="color:#55f19a;">5 credits on top</strong>,
                    on me. That is 10 free properties, fully QC'd, fully
                    auto-fixed, when you log back in. Run one of yours through
                    and tell me what you think.
                  </p>
                </div>
                <a href="${siteUrl}/login" style="display:inline-block;background:#55f19a;color:#07090c;padding:14px 24px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px;letter-spacing:0.01em;">
                  Claim my 10 free properties &rarr;
                </a>
              </td>
            </tr>

            ${featureCard({
              tagIcon: "→",
              tag: "Why come back",
              title: "Virtual Staging at $2 per room",
              copy: "Drop in an empty room, pick a style (Modern, Farmhouse, Scandinavian, Mid-Century, Coastal, Traditional). Photoreal staged shot in 15 seconds. Architecture stays exact. Same windows, same doorways. Custom direction on top if you want it. The industry charges $25-50 for this. We charge $2, and once you pay you can re-render the photo in any style for free.",
              ctaLabel: "See the styles",
              ctaUrl: `${siteUrl}/dashboard/staging`,
              accent: "#55f19a",
            })}

            ${featureCard({
              tagIcon: "🎁",
              tag: "Refer a friend",
              title: "25 free credits, both sides",
              copy: "Once you log back in, your dashboard has a referral link. Send it to one photographer or agency you trust. When they sign up, you both get 25 free credits. No cap, no expiration.",
              ctaLabel: "Grab your link",
              ctaUrl: `${siteUrl}/dashboard/refer`,
              accent: "#8df7b9",
            })}

            ${featureCard({
              tagIcon: "💬",
              tag: "Live support",
              title: "Meet Nova, in your dashboard",
              copy: "Bottom-right corner of every page. Ask her anything. Pricing, setup, why a photo got flagged. She is fast, she knows AutoQC cold, and a real human reads the logs behind her.",
              ctaLabel: "Open the dashboard",
              ctaUrl: `${siteUrl}/dashboard`,
              accent: "#7dd3fc",
            })}

            <tr>
              <td style="padding:28px 0 8px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="${siteUrl}/login" style="display:inline-block;background:#55f19a;color:#07090c;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-size:15px;letter-spacing:0.01em;">
                        Lock in my access &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 0 0 0;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#a5b0b8;">
                  Stop trading sleep for delivery times. Run one property and
                  see if it changes the way you ship.
                </p>
                <p style="margin:14px 0 0 0;font-size:13px;color:#a5b0b8;">
                  &mdash; Paul, founder
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:36px 0 0 0;border-top:1px solid rgba(255,255,255,0.06);margin-top:32px;">
                <p style="margin:24px 0 8px 0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6a7682;">
                  Why you are getting this
                </p>
                <p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;color:#6a7682;">
                  You created an AutoQC account but have not run your first
                  property yet. We send one nudge so you do not lose your seat
                  while we are in invite-only mode. We will not send another.
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

  const text = `Take your mornings back. Your AutoQC invite is still waiting.

Hey ${firstName},

You signed up for AutoQC but never ran your first property. We are still
in invite-only mode while we keep the platform tight, and your seat is
being held. Log back in this week to lock it in before we close
enrollment to the next round.

A note from me, founder to operator:

When you signed up, I dropped 5 free credits in your account so you
could try AutoQC without pulling out a card. They are still sitting
there waiting for you. And in an effort to get to know one another,
I would love to offer you another 5 credits on top, on me. That is
10 free properties, fully QC'd, fully auto-fixed, when you log back
in. Run one of yours through and tell me what you think.

Claim my 10 free properties: ${siteUrl}/login

Why come back:

1. Virtual Staging at $2 per room
   Drop in an empty room, pick a style. Photoreal staged shot in 15
   seconds. Architecture stays exact. The industry charges $25-50.
   We charge $2 and you can re-render the same photo in any style for
   free after that.
   ${siteUrl}/dashboard/staging

2. Refer a friend, 25 free credits both sides
   Your dashboard has a referral link. No cap, no expiration.
   ${siteUrl}/dashboard/refer

3. Live support in your dashboard
   Meet Nova. Ask her anything. Real human team behind her.
   ${siteUrl}/dashboard

Stop trading sleep for delivery times.

- Paul, founder

Unsubscribe: ${unsubscribeUrl}

${MAILING_ADDRESS}
`;

  return { html, text };
}

function featureCard(opts: {
  tagIcon: string;
  tag: string;
  title: string;
  copy: string;
  ctaLabel: string;
  ctaUrl: string;
  accent: string;
}): string {
  return `
            <tr>
              <td style="padding:16px 0 0 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d1117;border:1px solid rgba(255,255,255,0.06);border-radius:16px;">
                  <tr>
                    <td style="padding:24px 24px 20px 24px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="background:${opts.accent}20;border:1px solid ${opts.accent}40;border-radius:6px;padding:3px 8px;">
                            <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${opts.accent};font-weight:700;">${escapeHtml(opts.tagIcon)} ${escapeHtml(opts.tag)}</div>
                          </td>
                        </tr>
                      </table>
                      <h2 style="margin:14px 0 8px 0;font-size:19px;line-height:1.25;font-weight:600;color:#f5f7f9;letter-spacing:-0.01em;">
                        ${escapeHtml(opts.title)}
                      </h2>
                      <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#a5b0b8;">
                        ${escapeHtml(opts.copy)}
                      </p>
                      <a href="${opts.ctaUrl}" style="display:inline-block;color:${opts.accent};text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.01em;border-bottom:1px solid ${opts.accent}40;padding-bottom:2px;">
                        ${escapeHtml(opts.ctaLabel)} &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
