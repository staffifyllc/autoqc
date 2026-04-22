// Thin Resend client. Uses RESEND_API_KEY from env. No-op when unset so
// local dev / preview deploys do not crash trying to send.
//
// We call the REST API directly via fetch to avoid pulling the whole
// resend SDK for what is a one-endpoint operation.

const FROM = "AutoQC <autoqc@recruiting.gostaffify.com>";
const REPLY_TO = "pchareth@gmail.com";

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(args: SendArgs): Promise<{ id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[resend] RESEND_API_KEY not set, skipping send to", args.to);
    return { error: "RESEND_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(args.to) ? args.to : [args.to],
        reply_to: args.replyTo ?? REPLY_TO,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) {
      console.error("[resend] send failed:", res.status, data);
      return { error: data?.message ?? `HTTP ${res.status}` };
    }
    return { id: data.id };
  } catch (err: any) {
    console.error("[resend] send threw:", err);
    return { error: err.message ?? String(err) };
  }
}
