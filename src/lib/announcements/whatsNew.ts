// What's-new announcement email: self-serve signup, send feedback,
// landing refresh, Virtual Twilight. Dark-theme HTML, inline styles
// only (most email clients strip <style> tags). CSS hover works in
// modern clients and degrades gracefully.

export const WHATS_NEW_SUBJECT =
  "What's new at AutoQC: create accounts, send feedback, and more";

type Args = {
  recipientName?: string | null;
  unsubscribeUrl: string;
  siteUrl?: string;
};

const SITE_URL_DEFAULT = "https://www.autoqc.io";

// Physical address block for CAN-SPAM. Pulled from env so admins can
// update it without a deploy. If unset, we still ship but the address
// line shows a placeholder the admin can notice in preview.
const MAILING_ADDRESS =
  process.env.ANNOUNCEMENT_MAILING_ADDRESS ?? "AutoQC · add mailing address";

export function renderWhatsNewEmail({
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
    <title>What's new at AutoQC</title>
  </head>
  <body style="margin:0;padding:0;background:#07090c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e7ecef;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Self-serve signup, send feedback, a faster landing page, and Virtual Twilight for every exterior shot.
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
                  Product update · April 2026
                </div>
                <h1 style="margin:0 0 14px 0;font-size:32px;line-height:1.15;letter-spacing:-0.02em;font-weight:700;color:#f5f7f9;">
                  Four things shipped<br/>
                  <span style="background:linear-gradient(90deg,#55f19a 0%,#8df7b9 100%);-webkit-background-clip:text;background-clip:text;color:transparent;">this week.</span>
                </h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#a5b0b8;">
                  Hey ${escapeHtml(firstName)}, a lot landed at AutoQC over the past few days.
                  Here is the short version.
                </p>
              </td>
            </tr>

            ${featureCard({
              tagIcon: "+",
              tag: "New",
              title: "Self-serve signup",
              copy: "Anyone can create an AutoQC account at autoqc.io/signup. Ten seconds, no invite, no admin needed. Forward the link to your editor, your assistant, your cousin who shoots on weekends.",
              ctaLabel: "Share the signup page",
              ctaUrl: `${siteUrl}/signup`,
              accent: "#55f19a",
            })}

            ${featureCard({
              tagIcon: "!",
              tag: "New",
              title: "Send feedback: bugs and feature requests",
              copy: "The floating button at the bottom-right of the dashboard now does both. Report a bug and get an email when it is fixed, or suggest a feature and get an email when it ships. Every feature in AutoQC started as one of those.",
              ctaLabel: "Try it in the dashboard",
              ctaUrl: `${siteUrl}/dashboard`,
              accent: "#ffd166",
            })}

            ${featureCard({
              tagIcon: "*",
              tag: "Polish",
              title: "Landing page, rebuilt around speed",
              copy: "14 QC checks. 45 photos in under two minutes. Zero subscriptions. The new homepage makes the capability and the price land in the first two seconds. Worth a fresh look if you are pitching the service to a new agent.",
              ctaLabel: "See the new homepage",
              ctaUrl: siteUrl,
              accent: "#7dd3fc",
            })}

            ${featureCard({
              tagIcon: "~",
              tag: "Featured",
              title: "Virtual Twilight, $1 per exterior",
              copy: "Every daytime exterior can now be transformed into a photoreal dusk scene. Architecture preserved exactly, warm interior lights glowing, ambient blue light on the trees. Preview free, keep it for one credit. Listings photograph themselves.",
              ctaLabel: "Open a property to try it",
              ctaUrl: `${siteUrl}/dashboard/properties`,
              accent: "#c084fc",
            })}

            <tr>
              <td style="padding:28px 0 8px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="${siteUrl}/dashboard/updates" style="display:inline-block;background:#55f19a;color:#07090c;padding:14px 24px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px;letter-spacing:0.01em;">
                        See everything in Updates &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 0 0 0;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#a5b0b8;">
                  Ship something on AutoQC this week. If anything looks off, hit the Send
                  feedback button and let us know. We actually read them and usually ship
                  the fix before the next sunrise.
                </p>
                <p style="margin:14px 0 0 0;font-size:13px;color:#a5b0b8;">
                  &mdash; the AutoQC team
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:36px 0 0 0;border-top:1px solid rgba(255,255,255,0.06);margin-top:32px;">
                <p style="margin:24px 0 8px 0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6a7682;">
                  Why you are getting this
                </p>
                <p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;color:#6a7682;">
                  You have an AutoQC account and are opted into product update emails. We
                  send these when something meaningful ships. No drip campaigns, no weekly
                  digest.
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

  const text = `What's new at AutoQC

Hey ${firstName},

Four things shipped this week:

1. Self-serve signup
   Anyone can create an AutoQC account at ${siteUrl}/signup. No invite, no admin.

2. Send feedback: bugs and feature requests
   The floating button on the dashboard now does both. Bug reports and feature requests go to the same place, and we email you when they are resolved.

3. Landing page, rebuilt around speed
   14 QC checks. 45 photos in under two minutes. Zero subscriptions. ${siteUrl}

4. Virtual Twilight, $1 per exterior
   Every daytime exterior can become a photoreal dusk scene. Preview free, keep for one credit.

See everything: ${siteUrl}/dashboard/updates

Unsubscribe from product updates: ${unsubscribeUrl}

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
