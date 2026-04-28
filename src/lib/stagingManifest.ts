// Multi-angle staging support: extracts a precise spatial manifest of
// every piece of furniture in a staged image, anchored to architectural
// features. Stored on the anchor photo and re-used as positioning
// instructions when the customer stages other angles of the same room.
//
// Cost is minimal — one Claude Sonnet 4.6 vision call per anchor,
// roughly $0.005-$0.01 per call. Manifest is reused for every
// subsequent angle of the same room.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 600;

const SYSTEM_PROMPT = `You are an interior layout analyst. You will be shown a single photo of a fully-staged room. Your job is to describe the position of every piece of furniture in the photo, anchored precisely to the architectural features (windows, doors, walls, corners, fireplaces, fixtures, floor pattern).

Output a compact list, one piece per line, in this exact format:

  <piece>: <position relative to architecture>

Examples:
  Sofa: along the south wall, centered between the two windows
  Coffee table: 30 inches in front of the sofa, centered
  Armchair: northeast corner, angled toward the fireplace
  Sideboard: along the east wall, opposite the doorway to the kitchen
  Wall art: above the sofa, centered between the two windows
  Area rug: under the coffee table, extending to just past the front edge of the sofa

Rules:
- Always reference architecture, never abstract grid coordinates
- Be specific about WHICH wall, WHICH corner, WHICH window
- Include scale cues where useful (e.g. "30 inches in front of", "2 feet from the wall")
- Cover every meaningful piece, including rugs and wall art
- Skip tiny accent items (single throw pillow, single book) unless they're load-bearing for the design
- Do NOT describe the architecture itself — only the position of furniture within it
- Do NOT include color, material, or style descriptions — those are captured separately

Output the list and nothing else. No preamble, no closing remarks.`;

export async function buildSpatialManifest(args: {
  imageUrl: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to Vercel env to enable spatial-manifest generation."
    );
  }

  // Fetch the image, convert to base64. Anthropic vision supports
  // both URL and base64; we use base64 for stability against signed-URL
  // expiry mid-call.
  const imgRes = await fetch(args.imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Could not fetch staged image: ${imgRes.status}`);
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const contentType = (imgRes.headers.get("content-type") || "image/jpeg")
    .split(";")[0]
    .trim();
  const base64 = buf.toString("base64");

  const anthropic = new Anthropic({ apiKey });
  const completion = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: contentType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Describe the position of every piece of furniture in this room, anchored to the architectural features.",
          },
        ],
      },
    ],
  });

  const manifest = completion.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n")
    .trim();

  if (!manifest) {
    throw new Error("Empty manifest from Vision call");
  }
  return manifest;
}
