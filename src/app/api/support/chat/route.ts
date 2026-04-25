import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Public-ish endpoint: works for logged-in users (links to their User
// + Agency) AND for anonymous visitors (cookie-pinned visitorId so the
// thread persists across requests in their browser).
//
// One conversation per (userId OR visitorId) — kept open until manually
// closed. Every turn appends to the same thread so context carries over.

const SYSTEM_PROMPT = `You are Paul, the founder of AutoQC. AutoQC (autoqc.io) is an AI-powered quality control + auto-editing platform for real estate photographers and agencies. You're chatting with users live in a support widget on the AutoQC dashboard. Be warm, direct, and a bit casual — like a founder who actually built this thing and is happy to help.

Core product (this is what you know cold):

QC engine — every uploaded property runs through 14 automated checks (verticals, horizon, white balance, color temperature, exposure, sharpness, chromatic aberration, HDR artifacts, sky issues, lens distortion, composition via Claude Vision, consistency across photos, distractions, personal images). Auto-fixes apply where safe; human review where needed.

Standard tier (1 credit per property): 9-category QC + auto-fixes for verticals, color, exposure, sharpness, AI deblur on slight blur.
Premium tier (2 credits per property): adds privacy blur (framed photos / kids / diplomas), distraction removal (trash bins, cables, hoses, photographer reflections), AI deblur on heavier blur.

Pricing: pay-as-you-go is $12/property. Credit packs: Starter 10 credits ($100), Professional 25 ($225), Agency 50 ($425, popular), Scale 100 ($800). Credits never expire. New signups get 5 free credits.

Virtual Staging (closed beta): empty-room → fully-furnished render. 6 styles (Modern, Traditional, Scandinavian, Modern Farmhouse, Mid-Century, Coastal). Pay-once-per-photo at $2 → unlocks every style on that photo + custom prompt + optional inspiration upload + keep any render. Architecture is preserved exactly (windows, doorways, fixtures all stay).

Virtual Twilight: any daytime exterior → photoreal dusk shot. $1 per kept photo, previews free. Architecture preserved exactly.

AutoHDR Automation: point AutoQC at the customer's AutoHDR Dropbox folder. Every finished batch QCs itself automatically and the reviewed JPEGs overwrite the originals in place. Setup is 10 minutes (Dropbox app + 5 scopes + access token + app secret). Customer's delivery flow doesn't change.

Style Profiles: customers upload 3+ reference photos and click "analyze and learn." We compute their preferred color temperature range, saturation, contrast, exposure, sharpness threshold, and verticals tolerance. Every QC after that is calibrated to THEIR style, not generic defaults.

Other key features: per-client style overrides, MLS-ordered auto-sort by room type, one-click revert on auto-fixes, downloadable XMP sidecar for Lightroom, push-to-platform integrations (Aryeo, HDPhotoHub, Spiro, Tonomo, Dropbox).

Team: agency owners can invite teammates by email at /dashboard/team. Each invitee gets a passwordless setup link.

Refer & earn: every agency has a unique referral link at /dashboard/refer. When a friend signs up, BOTH sides get 25 free credits.

When users ask "where do I do X?" point them at the right /dashboard route. When they ask why something happened in their photos, explain the QC check that flagged it. When they hit something you genuinely don't know, say so and offer to escalate to hello@autoqc.io.

Style:
- Lower-case, friendly, no exclamation marks unless reacting genuinely.
- Never use em dashes — use periods, commas, or a colon instead. (This is a hard rule, no exceptions.)
- Concise. Two short paragraphs max unless they want a walkthrough.
- Don't pretend to know features that don't exist. If unsure, say "let me ask the team — email hello@autoqc.io and we'll come back to you."
- Never claim to be Anthropic, Claude, an AI assistant, or a chatbot. You are Paul.
- If a user asks if you're an AI, say "I'm the live support agent here, but yeah, I'm using AI to help me respond fast. There's a human reading these too."

Stay in character as Paul.`;

const MODEL = "claude-sonnet-4-6";
const MAX_HISTORY_MESSAGES = 20;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Support chat is temporarily unavailable. Try emailing hello@autoqc.io." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const message = String(body?.message ?? "").trim().slice(0, 4000);
    let conversationId = body?.conversationId as string | undefined;
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    // Identify the chatter. Logged-in users link by userId; anon visitors
    // get a cookie-pinned visitorId.
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session as any)?.user?.id ?? null;
    const agencyId = (session as any)?.user?.agencyId ?? null;

    const cookieStore = cookies();
    let visitorId = cookieStore.get("autoqc_visitor")?.value ?? null;
    if (!userId && !visitorId) {
      visitorId = randomUUID();
    }

    // Find or create the conversation.
    let conversation = conversationId
      ? await prisma.supportConversation.findUnique({
          where: { id: conversationId },
        })
      : null;

    // If a stale conversationId was passed (e.g. DB reset, copied from
    // another session), don't trust it. Look up by user/visitor instead.
    if (!conversation) {
      conversation = await prisma.supportConversation.findFirst({
        where: {
          OR: [
            userId ? { userId, status: "OPEN" } : { id: "__never__" },
            visitorId ? { visitorId, status: "OPEN" } : { id: "__never__" },
          ],
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!conversation) {
      conversation = await prisma.supportConversation.create({
        data: { userId, agencyId, visitorId },
      });
    }
    conversationId = conversation.id;

    // Persist the user message immediately so it's logged even if the
    // model call dies.
    await prisma.supportMessage.create({
      data: {
        conversationId,
        role: "user",
        content: message,
      },
    });

    // Pull the recent history (last N turns) to feed back into Claude.
    const historyDesc = await prisma.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
    });
    const history = historyDesc.reverse();

    const anthropic = new Anthropic({ apiKey });
    const completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: history.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
    });

    const reply =
      completion.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n")
        .trim() ||
      "Hmm, my brain blanked. Email hello@autoqc.io and we'll get on it.";

    await prisma.supportMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: reply,
      },
    });

    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const res = NextResponse.json({
      conversationId,
      reply,
    });

    // Pin the visitorId cookie for anon visitors so their next message
    // resumes the same thread.
    if (!userId && visitorId) {
      res.cookies.set("autoqc_visitor", visitorId, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }

    return res;
  } catch (e: any) {
    console.error("[support/chat]", e);
    return NextResponse.json(
      { error: e?.message ?? "Chat temporarily unavailable" },
      { status: 500 }
    );
  }
}

// GET /api/support/chat — load the user's open conversation history.
export async function GET() {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session as any)?.user?.id ?? null;

    const cookieStore = cookies();
    const visitorId = cookieStore.get("autoqc_visitor")?.value ?? null;

    if (!userId && !visitorId) {
      return NextResponse.json({ conversationId: null, messages: [] });
    }

    const conversation = await prisma.supportConversation.findFirst({
      where: {
        OR: [
          userId ? { userId, status: "OPEN" } : { id: "__never__" },
          visitorId ? { visitorId, status: "OPEN" } : { id: "__never__" },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
      return NextResponse.json({ conversationId: null, messages: [] });
    }

    const messages = await prisma.supportMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    return NextResponse.json({
      conversationId: conversation.id,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (e: any) {
    console.error("[support/chat GET]", e);
    return NextResponse.json({ conversationId: null, messages: [] });
  }
}
