import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";

// POST /api/affiliates/apply
// Public endpoint. Forwards the application to hello@autoqc.io. No DB
// table for now — keep it simple, evaluate manually, upgrade to a real
// affiliate dashboard once we have 5+ active partners actually moving
// volume.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const audience = String(body?.audience ?? "").trim();
    const reach = String(body?.reach ?? "").trim();
    const why = String(body?.why ?? "").trim();

    if (!name || !email || !audience || !reach) {
      return NextResponse.json(
        { error: "name, email, audience, and reach are required" },
        { status: 400 }
      );
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { error: "That email does not look right." },
        { status: 400 }
      );
    }
    // Keep individual fields short enough that the rendered email stays
    // sane and abuse from someone pasting megabytes is bounded.
    if (
      name.length > 200 ||
      audience.length > 500 ||
      reach.length > 2000 ||
      why.length > 2000
    ) {
      return NextResponse.json(
        { error: "One or more fields are too long" },
        { status: 400 }
      );
    }

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#f4f5f7;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
        <div style="display:inline-block;background:#10c76c;color:#fff;padding:6px 10px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:16px;">New affiliate application</div>
        <table style="width:100%;font-size:14px;">
          <tr><td style="font-weight:600;padding:6px 0;width:130px;color:#374151;">Name</td><td style="padding:6px 0;">${escapeHtml(name)}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;color:#374151;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          <tr><td style="font-weight:600;padding:6px 0;color:#374151;">Audience</td><td style="padding:6px 0;">${escapeHtml(audience)}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;vertical-align:top;color:#374151;">Reach</td><td style="padding:6px 0;white-space:pre-wrap;">${escapeHtml(reach)}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;vertical-align:top;color:#374151;">Why</td><td style="padding:6px 0;white-space:pre-wrap;">${escapeHtml(why || "(blank)")}</td></tr>
        </table>
      </div>
    </body></html>`;

    const text = `New affiliate application

Name: ${name}
Email: ${email}
Audience: ${audience}

Reach:
${reach}

Why:
${why || "(blank)"}
`;

    sendEmail({
      to: "hello@autoqc.io",
      subject: `Affiliate application: ${name} (${email})`,
      html,
      text,
      replyTo: email,
    } as any).catch((err) =>
      console.error("affiliate application email failed", err)
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[affiliates/apply]", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed" },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
