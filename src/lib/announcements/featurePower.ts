// Feature-showcase email. The "this is what AutoQC actually does"
// deep-dive that customers should see at least once. Dark theme,
// numbers-forward, big visual moments, sleek.

export const FEATURE_POWER_SUBJECT =
  "AutoQC, end to end. 14 checks. 9 auto-fixes. 90 seconds.";

type Args = {
  recipientName?: string | null;
  unsubscribeUrl: string;
  siteUrl?: string;
};

const SITE_URL_DEFAULT = "https://www.autoqc.io";

const MAILING_ADDRESS =
  process.env.ANNOUNCEMENT_MAILING_ADDRESS ?? "AutoQC · add mailing address";

export function renderFeaturePowerEmail({
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
    <title>AutoQC, end to end</title>
  </head>
  <body style="margin:0;padding:0;background:#07090c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e7ecef;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      14 QC checks. 9 auto-fixes. Style Profiles. Virtual Staging at \$2. Virtual Twilight at \$1. AutoHDR Dropbox automation. Live support. End-to-end editing in 90 seconds.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#07090c;">
      <tr>
        <td align="center" style="padding:32px 16px 16px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">

            <!-- Brand -->
            <tr>
              <td style="padding:0 0 28px 0;">
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

            <!-- Hero -->
            <tr>
              <td style="background:linear-gradient(140deg,#0d1117 0%,#162032 50%,#0d1117 100%);border:1px solid rgba(85,241,154,0.22);border-radius:24px;padding:48px 36px 44px 36px;">
                <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#55f19a;margin-bottom:18px;">
                  THE COMPLETE TOUR
                </div>
                <h1 style="margin:0 0 18px 0;font-size:40px;line-height:1.05;letter-spacing:-0.025em;font-weight:700;color:#f5f7f9;">
                  Take your<br/>
                  <span style="background:linear-gradient(90deg,#55f19a 0%,#8df7b9 50%,#7dd3fc 100%);-webkit-background-clip:text;background-clip:text;color:transparent;">mornings back.</span>
                </h1>
                <p style="margin:0 0 28px 0;font-size:16px;line-height:1.55;color:#a5b0b8;">
                  Hey ${escapeHtml(firstName)}. Here is the full picture of what
                  AutoQC actually does, end to end. The boring stuff that eats
                  your evenings and weekends, automated. The visual upgrades
                  agents pay extra for, productized. Real numbers below.
                </p>

                <!-- Stat row -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${statCell("14", "QC checks per photo")}
                    ${statCell("9", "auto-fixes")}
                    ${statCell("90s", "per property")}
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:32px 0 18px 0;">
                <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#55f19a;">
                  The QC engine
                </div>
                <h2 style="margin:8px 0 0 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#f5f7f9;">
                  Every photo, fully audited.
                </h2>
              </td>
            </tr>

            ${featureBlock({
              accent: "#55f19a",
              title: "14 automated quality checks",
              copy: "Verticals. Horizon. White balance. Color cast. Exposure. Sharpness. Chromatic aberration. HDR halos. Sky artifacts. Lens distortion. Composition (Claude Vision). Cross-photo consistency. Distractions. Personal images. Every shot, every property, scored and fixed before you see it.",
            })}

            ${featureBlock({
              accent: "#55f19a",
              title: "9 auto-fixes that just happen",
              copy: "Verticals corrected up to 5 degrees. Horizon levelled up to 3 degrees. Color casts neutralized. Subtle blur restored with AI deblur. White balance tightened to your preferred range. Personal photos blurred for privacy. Distractions inpainted out of frame. You see the corrected photo first; the original is one click away.",
            })}

            ${featureBlock({
              accent: "#7dd3fc",
              title: "Style Profiles, learned from your work",
              copy: "Upload three or more reference photos and click Analyze and learn. AutoQC computes your preferred color temperature range, saturation, contrast, exposure, sharpness threshold, and verticals tolerance. Every QC after that is calibrated to your style, not a generic default. Per-client overrides supported.",
              ctaUrl: `${siteUrl}/dashboard/profiles`,
              ctaLabel: "Train your style",
            })}

            <!-- Divider -->
            <tr>
              <td style="padding:36px 0 18px 0;">
                <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#fbbf24;">
                  Visual upgrades
                </div>
                <h2 style="margin:8px 0 0 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#f5f7f9;">
                  Make the listing pop.
                </h2>
              </td>
            </tr>

            ${featureBlock({
              accent: "#fbbf24",
              title: "Virtual Staging — $2 per room",
              copy: "Drop in an empty room, pick a style. Modern, Traditional, Scandinavian, Modern Farmhouse, Mid-Century, Coastal. Photoreal staged render in 15 seconds. Architecture preserved exactly: same windows, same doorways, same light. Custom direction layered on top. Pay $2 once and re-render that photo in any style for free. The industry charges $25 to $50 for this.",
              ctaUrl: `${siteUrl}/dashboard/staging`,
              ctaLabel: "Stage a room",
            })}

            ${featureBlock({
              accent: "#a78bfa",
              title: "Virtual Twilight — $1 per photo",
              copy: "Any daytime exterior, transformed into a photoreal dusk shot in 10 seconds. Warm interior glow through the windows, ambient dusk lighting on every surface. Architecture unchanged. Preview free, keep the version you like for $1.",
              ctaUrl: `${siteUrl}/dashboard/properties`,
              ctaLabel: "Try Twilight",
            })}

            <!-- Divider -->
            <tr>
              <td style="padding:36px 0 18px 0;">
                <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#67e8f9;">
                  Workflow
                </div>
                <h2 style="margin:8px 0 0 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#f5f7f9;">
                  Plugs into how you already work.
                </h2>
              </td>
            </tr>

            ${featureBlock({
              accent: "#67e8f9",
              title: "AutoHDR → AutoQC, while you sleep",
              copy: "Point AutoQC at your AutoHDR Dropbox folder once. Every finished batch runs the full QC and auto-fix pass automatically, and the reviewed JPEGs overwrite the originals in place. Ten-minute setup, runs forever. Thursday-night uploads ship Friday morning, untouched by you.",
              ctaUrl: `${siteUrl}/dashboard/dropbox-automation`,
              ctaLabel: "Wire up Dropbox",
            })}

            ${featureBlock({
              accent: "#67e8f9",
              title: "MLS-ordered auto-sort, by room type",
              copy: "Every photo is room-type tagged during QC. Flip auto-sort on once and AutoQC groups your gallery in your preferred MLS sequence everywhere. QC grid, ZIP download, and platform pushes all match. Drag the order, save, done.",
              ctaUrl: `${siteUrl}/dashboard/configure/sort-order`,
              ctaLabel: "Set the order",
            })}

            ${featureBlock({
              accent: "#67e8f9",
              title: "One-click revert. XMP for Lightroom.",
              copy: "Disagree with an auto-fix? Click Revert. Original bytes export and push to MLS until you flip back. Need the underlying adjustments in Lightroom? Download a Lightroom-compatible bundle with XMP sidecars. AI proposes, you approve.",
            })}

            <!-- Divider -->
            <tr>
              <td style="padding:36px 0 18px 0;">
                <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f472b6;">
                  Premium tier
                </div>
                <h2 style="margin:8px 0 0 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#f5f7f9;">
                  When the photo deserves more.
                </h2>
              </td>
            </tr>

            ${featureBlock({
              accent: "#f472b6",
              title: "Privacy blur + distraction removal",
              copy: "Premium adds two AI passes the QC tier does not run. Personal images (framed photos, kids, diplomas) are detected and blurred so the listing does not leak the seller's life. Distractions (trash bins, cables, hoses, photographer reflections) are detected by Claude and inpainted out of frame by Replicate. Plus AI deblur on heavier blur. 2 credits per property.",
            })}

            <!-- Divider -->
            <tr>
              <td style="padding:36px 0 18px 0;">
                <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a5b0b8;">
                  Support + pricing
                </div>
              </td>
            </tr>

            ${featureBlock({
              accent: "#55f19a",
              title: "Live support inside the dashboard",
              copy: "Bottom-right of every page, every day. Meet Nova, our support specialist. Ask anything: pricing, setup, why a photo got flagged, how to set a profile up. Fast, sharp, and a real human reads the logs behind her.",
            })}

            ${featureBlock({
              accent: "#55f19a",
              title: "Pricing that gets cheaper as you scale",
              copy: "Pay-as-you-go is $12 per property. Credit packs: 10 for $100, 25 for $225, 50 for $425, 100 for $800. Credits never expire. New signups get 5 free. Refer a friend, you both get 25 more. No subscriptions, no contracts, no minimums.",
              ctaUrl: `${siteUrl}/pricing`,
              ctaLabel: "See pricing",
            })}

            <!-- Big CTA -->
            <tr>
              <td style="padding:36px 0 8px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(140deg,#0d1117 0%,#162032 100%);border:1px solid rgba(85,241,154,0.3);border-radius:20px;">
                  <tr>
                    <td style="padding:36px 32px;text-align:center;">
                      <h2 style="margin:0 0 8px 0;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#f5f7f9;">
                        Run one shoot through.
                      </h2>
                      <p style="margin:0 0 20px 0;font-size:14px;line-height:1.55;color:#a5b0b8;max-width:420px;margin-left:auto;margin-right:auto;">
                        Upload a property, watch what comes back, decide if it
                        changes the way you ship work.
                      </p>
                      <a href="${siteUrl}/dashboard" style="display:inline-block;background:#55f19a;color:#07090c;padding:15px 32px;border-radius:14px;font-weight:600;text-decoration:none;font-size:15px;letter-spacing:0.01em;">
                        Open dashboard &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 0 0 0;">
                <p style="margin:0;font-size:13px;line-height:1.65;color:#a5b0b8;">
                  Questions? Hit reply. Or chat with Nova in the dashboard.
                </p>
                <p style="margin:14px 0 0 0;font-size:13px;color:#a5b0b8;">
                  &mdash; Paul, founder
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:48px 0 0 0;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:24px 0 8px 0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6a7682;">
                  Why you are getting this
                </p>
                <p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;color:#6a7682;">
                  You have an AutoQC account and are opted into product update
                  emails. We send these only when something meaningful ships.
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

  const text = `Take your mornings back.

Hey ${firstName},

Here is the full picture of what AutoQC does, end to end.

THE QC ENGINE
- 14 automated checks per photo: verticals, horizon, white balance,
  color cast, exposure, sharpness, chromatic aberration, HDR halos,
  sky artifacts, lens distortion, composition, consistency,
  distractions, personal images.
- 9 auto-fixes that just happen: vertical correction, horizon level,
  color cast neutralization, AI deblur, white balance, privacy blur,
  distraction inpainting, more.
- Style Profiles: upload your own reference photos and AutoQC
  calibrates the QC to YOUR style.
  ${siteUrl}/dashboard/profiles

VISUAL UPGRADES
- Virtual Staging at $2 per room. Six styles, architecture preserved,
  custom direction supported, re-render free after first $2.
  ${siteUrl}/dashboard/staging
- Virtual Twilight at $1 per photo. Daytime exterior to photoreal
  dusk shot in 10 seconds.
  ${siteUrl}/dashboard

WORKFLOW
- AutoHDR -> AutoQC: point us at your Dropbox folder, every batch
  is QC'd automatically, reviewed JPEGs overwrite originals in place.
  ${siteUrl}/dashboard/dropbox-automation
- MLS auto-sort by room type. Drag your preferred order once.
  ${siteUrl}/dashboard/configure/sort-order
- One-click revert. XMP for Lightroom.

PREMIUM TIER
- Privacy blur (framed photos, kids, diplomas).
- Distraction removal (trash bins, cables, photographer reflections).
- AI deblur on heavier blur. 2 credits per property.

SUPPORT + PRICING
- Live support: chat with Nova in the dashboard, every page.
- Pay-as-you-go $12/property, packs from $100 to $800, credits
  never expire, 5 free for new signups, 25 free for referrals.
  ${siteUrl}/pricing

Run one shoot through. Watch what comes back.
${siteUrl}/dashboard

- Paul, founder

Unsubscribe: ${unsubscribeUrl}

${MAILING_ADDRESS}
`;

  return { html, text };
}

function statCell(num: string, label: string): string {
  return `
                    <td width="33%" style="padding:0 6px;text-align:center;">
                      <div style="background:rgba(85,241,154,0.06);border:1px solid rgba(85,241,154,0.18);border-radius:14px;padding:18px 8px;">
                        <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;color:#55f19a;letter-spacing:-0.02em;line-height:1;margin-bottom:6px;">${escapeHtml(num)}</div>
                        <div style="font-size:11px;color:#a5b0b8;letter-spacing:0.02em;line-height:1.3;">${escapeHtml(label)}</div>
                      </div>
                    </td>`;
}

function featureBlock(opts: {
  accent: string;
  title: string;
  copy: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const cta = opts.ctaUrl
    ? `<a href="${opts.ctaUrl}" style="display:inline-block;color:${opts.accent};text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.01em;border-bottom:1px solid ${opts.accent}40;padding-bottom:2px;">${escapeHtml(opts.ctaLabel ?? "Learn more")} &rarr;</a>`
    : "";
  return `
            <tr>
              <td style="padding:12px 0 0 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d1117;border:1px solid rgba(255,255,255,0.06);border-radius:18px;">
                  <tr>
                    <td style="padding:24px 26px 22px 26px;">
                      <div style="display:inline-block;width:6px;height:24px;background:${opts.accent};border-radius:3px;vertical-align:middle;margin-right:10px;"></div>
                      <span style="font-size:18px;font-weight:600;color:#f5f7f9;letter-spacing:-0.01em;vertical-align:middle;">${escapeHtml(opts.title)}</span>
                      <p style="margin:14px 0 ${cta ? "16px" : "0"} 0;font-size:14px;line-height:1.65;color:#b3bcc4;">
                        ${escapeHtml(opts.copy)}
                      </p>
                      ${cta}
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
