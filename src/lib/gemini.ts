// Virtual Twilight provider. Despite the filename, this now routes
// through Replicate because Google's Gemini API does not have a free
// tier for image generation (both 2.5 Flash Image and 3 Pro Image
// require billing enabled on a Google Cloud project).
//
// Replicate is already wired up for AI deblur + distraction removal
// in the QC engine, so the REPLICATE_API_TOKEN is already present in
// every env. Same pay-as-you-go billing, no new credit card.
//
// Model: google-deepmind/nano-banana. Same Gemini 2.5 Flash Image
// weights, hosted on Replicate infra. ~$0.04 per image. At $1 retail
// that is still a 96% margin.

const REPLICATE_MODEL = "google/nano-banana";

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

async function replicatePredict(args: {
  model: string;
  input: Record<string, unknown>;
}): Promise<string[]> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }

  // Synchronous prediction via the sync endpoint. `Prefer: wait` makes
  // Replicate hold the HTTP connection until the prediction completes
  // (up to 60s). For longer runs it falls back to async + polling.
  const res = await fetch(
    `https://api.replicate.com/v1/models/${args.model}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({ input: args.input }),
    }
  );

  const raw = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Replicate returned non-JSON: ${raw.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(
      `Replicate ${res.status}: ${parsed?.detail ?? parsed?.title ?? raw.slice(0, 300)}`
    );
  }

  // If still running after 60s, poll.
  if (parsed.status === "starting" || parsed.status === "processing") {
    const pollUrl = parsed.urls?.get;
    if (!pollUrl) throw new Error("Replicate did not return a poll URL");
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const p = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pj = await p.json();
      if (pj.status === "succeeded") {
        parsed = pj;
        break;
      }
      if (pj.status === "failed" || pj.status === "canceled") {
        throw new Error(`Replicate prediction ${pj.status}: ${pj.error ?? ""}`);
      }
    }
  }

  if (parsed.status !== "succeeded") {
    throw new Error(
      `Replicate prediction did not complete: status=${parsed.status}`
    );
  }

  // Output shape: string URL or array of URLs depending on the model.
  const out = parsed.output;
  if (typeof out === "string") return [out];
  if (Array.isArray(out)) return out.filter((v) => typeof v === "string");
  throw new Error(`Unexpected Replicate output shape: ${JSON.stringify(out).slice(0, 200)}`);
}

export async function geminiEditImage(args: {
  sourceUrl: string;
  prompt: string;
}): Promise<GeneratedImage> {
  // Nano Banana on Replicate takes an image_input (array of URLs) plus
  // prompt. Output is an image URL (or array).
  const urls = await replicatePredict({
    model: REPLICATE_MODEL,
    input: {
      prompt: args.prompt,
      image_input: [args.sourceUrl],
      output_format: "jpg",
    },
  });

  if (urls.length === 0) {
    throw new Error("Replicate returned no image URL");
  }

  const imgRes = await fetch(urls[0]);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch generated image: HTTP ${imgRes.status}`);
  }
  const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
  const bytes = Buffer.from(await imgRes.arrayBuffer());
  return { bytes, mimeType };
}
