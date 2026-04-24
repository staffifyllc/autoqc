// Password-reset transactional emails. Two variants share the same shell:
//   renderPasswordResetEmail  — generic "you asked to reset your password"
//   renderWelcomeBackEmail    — apology + reset link (for the luximmophoto
//                                style mix-up where we need to re-engage a
//                                specific user)

export const PASSWORD_RESET_SUBJECT = "Reset your AutoQC password";
export const WELCOME_BACK_SUBJECT = "Sorry about the hiccup. 5 credits on us.";

const SITE_URL_DEFAULT = "https://www.autoqc.io";

type ResetArgs = {
  resetUrl: string;
  siteUrl?: string;
};

type WelcomeBackArgs = {
  resetUrl: string;
  siteUrl?: string;
};

export function renderPasswordResetEmail({
  resetUrl,
  siteUrl = SITE_URL_DEFAULT,
}: ResetArgs): { html: string; text: string } {
  const body = `
    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#55f19a;margin-bottom:14px;">
      Password reset
    </div>
    <h1 style="margin:0 0 14px 0;font-size:28px;line-height:1.2;letter-spacing:-0.02em;font-weight:700;color:#f5f7f9;">
      Let's get you<br/>
      <span style="background:linear-gradient(90deg,#55f19a 0%,#8df7b9 100%);-webkit-background-clip:text;background-clip:text;color:transparent;">back in.</span>
    </h1>
    <p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#a5b0b8;">
      Someone (hopefully you) asked to reset the password for this AutoQC account. Click the button below to choose a new one. The link is good for 60 minutes.
    </p>
    ${primaryCta(resetUrl, "Reset Your Password")}
    <p style="margin:28px 0 0 0;font-size:13px;line-height:1.55;color:#6a7682;">
      If you did not request this, you can safely ignore this email. Your current password will not change.
    </p>`;

  const html = shell(body);
  const text = `Reset your AutoQC password

Someone (hopefully you) asked to reset the password for this AutoQC account.

Click this link to choose a new one (expires in 60 minutes):
${resetUrl}

If you did not request this, you can safely ignore this email.

AutoQC · ${siteUrl}
`;
  return { html, text };
}

export function renderWelcomeBackEmail({
  resetUrl,
  siteUrl = SITE_URL_DEFAULT,
}: WelcomeBackArgs): { html: string; text: string } {
  const body = `
    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#55f19a;margin-bottom:14px;">
      A note from AutoQC
    </div>
    <h1 style="margin:0 0 14px 0;font-size:28px;line-height:1.2;letter-spacing:-0.02em;font-weight:700;color:#f5f7f9;">
      Sorry about<br/>
      <span style="background:linear-gradient(90deg,#55f19a 0%,#8df7b9 100%);-webkit-background-clip:text;background-clip:text;color:transparent;">the hiccup.</span>
    </h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:#a5b0b8;">
      Your AutoQC account hit a snag on our end earlier today. It is sorted now.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;">
      <tr>
        <td style="background:#0d1117;border:1px solid rgba(85,241,154,0.25);border-radius:14px;padding:22px 24px;text-align:center;">
          <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#55f19a;margin-bottom:6px;">
            On us
          </div>
          <div style="font-size:40px;line-height:1;font-weight:700;letter-spacing:-0.03em;background:linear-gradient(90deg,#55f19a 0%,#8df7b9 100%);-webkit-background-clip:text;background-clip:text;color:transparent;">
            5 credits
          </div>
          <div style="margin-top:6px;font-size:13px;color:#a5b0b8;">
            That's 5 properties processed, no card required.
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 26px 0;font-size:15px;line-height:1.6;color:#a5b0b8;">
      Set a new password and you're in. Takes 10 seconds.
    </p>
    ${primaryCta(resetUrl, "Set Your Password")}
    <p style="margin:28px 0 0 0;font-size:13px;line-height:1.55;color:#6a7682;">
      If anything else feels off, reply to this email and it comes straight to us.
    </p>
    <p style="margin:18px 0 0 0;font-size:13px;line-height:1.55;color:#a5b0b8;">
      &mdash; The AutoQC Team
    </p>`;

  const html = shell(body);
  const text = `Sorry about the hiccup.

Your AutoQC account hit a snag on our end earlier today. It is sorted now.

To make it right, we have dropped 5 free credits into your account. That's 5 properties processed on the house, no card required.

Set a new password and you are in (link expires in 60 minutes):
${resetUrl}

If anything else feels off, reply to this email and it comes straight to us.

— The AutoQC Team
${siteUrl}
`;
  return { html, text };
}

function primaryCta(url: string, label: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="background:linear-gradient(90deg,#55f19a 0%,#8df7b9 100%);border-radius:10px;">
          <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#07090c;text-decoration:none;letter-spacing:0.01em;">
            ${escapeHtml(label)} &rarr;
          </a>
        </td>
      </tr>
    </table>`;
}

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AutoQC</title>
  </head>
  <body style="margin:0;padding:0;background:#07090c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e7ecef;">
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
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 0 40px 0;text-align:center;">
                <p style="margin:0;font-size:11px;color:#4b5560;">
                  AutoQC &middot; autoqc.io
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
