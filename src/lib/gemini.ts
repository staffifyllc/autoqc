// Gemini 2.5 Flash Image ("Nano Banana") wrapper for virtual-twilight
// and future AI add-ons. Speaks the v1beta generateContent API directly
// over fetch to avoid pulling the whole google-genai SDK.
//
// Cost: $0.039 per image on the paid tier. Free tier caps at 1,500
// requests per day which covers all preview traffic for the beta.

// Nano Banana (Gemini 2.5 Flash Image, stable). Has a free tier
// (1500/day) so beta testing does not cost anything. Upgrade path:
// flip to `gemini-3-pro-image-preview` once billing is enabled on the
// Google Cloud project. Pro is better quality but paid-only (no free
// tier at all).
const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Base prompt for virtual twilight. Tuned to preserve geometry and
// avoid the "AI added a gazebo" class of edits. Paul can iterate.
export const TWILIGHT_PROMPT = `Transform this daytime real estate exterior photo into a photorealistic twilight scene, as if the photographer returned at dusk and shot the exact same frame:

- Deep blue-to-purple sky with a warm amber/orange glow low on the horizon
- Interior lights glowing warmly through every window (soft amber, natural intensity)
- Exterior landscape lighting activated: walkway lights, porch lamps, driveway lighting, soffit lights if present
- Soft ambient dusk illumination on all property surfaces, consistent sun direction
- Accurate shadows and reflections consistent with a low dusk sun
- Subtle warmth on stone, brick, or siding facing the last light

CRITICAL rules you must not break:
- Preserve the exact architecture, property features, landscaping, trees, vehicles, and composition of the original photo. Do not add or remove any structural elements, people, vehicles, pets, or objects.
- Do not alter the crop, framing, aspect ratio, or camera angle.
- The result must look like the same photo taken at twilight, not a different scene.
- No fireworks, no rainbows, no dramatic atmospheric effects beyond natural dusk lighting.
- Keep the photo realistic and MLS-appropriate. No over-saturated sky colors.`;

type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;
};

async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch source image: HTTP ${res.status}`);
  }
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mimeType };
}

// Run a Gemini image edit. Takes a source image URL and a text prompt,
// returns the generated image bytes + mime type. Caller is responsible
// for uploading to S3 and persisting.
export async function geminiEditImage(args: {
  sourceUrl: string;
  prompt: string;
}): Promise<GeneratedImage> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const { data, mimeType } = await fetchImageAsBase64(args.sourceUrl);

  const body = {
    contents: [
      {
        parts: [
          { text: args.prompt },
          { inline_data: { mime_type: mimeType, data } },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inline_data?: { mime_type?: string; data?: string };
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked the request: ${json.promptFeedback.blockReason}`
    );
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline: any = part.inline_data || part.inlineData;
    if (inline?.data) {
      return {
        bytes: Buffer.from(inline.data, "base64"),
        mimeType: inline.mime_type || inline.mimeType || "image/png",
      };
    }
  }

  throw new Error("Gemini returned no image in the response");
}
