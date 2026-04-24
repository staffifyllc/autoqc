// OpenAI gpt-image-1 provider for image editing tasks.
// Used by Virtual Staging — historically we used nano-banana (Gemini
// 2.5 Flash Image via Replicate) but it hallucinated architecture:
// doorways disappeared, art got hung over windows. gpt-image-1's
// instruction-following on negative constraints is meaningfully
// better for room edits.
//
// Endpoint: POST https://api.openai.com/v1/images/edits
// Accepts multipart/form-data with image + prompt, returns b64-encoded
// PNG bytes in JSON.
//
// Pricing (as of release): low ~$0.011, medium ~$0.042, high ~$0.17.
// At $2 retail for a keeper staging render we target "high" so the
// output quality justifies the price. Still a ~90% margin.

type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;
};

// `quality` isn't accepted on /v1/images/edits — it's a generate-only
// param. gpt-image-1 edit renders at its default quality (roughly
// equivalent to "high" on generate). Kept in the signature as a no-op
// hint in case OpenAI adds it later.
type Quality = "low" | "medium" | "high" | "auto";
type Size = "1024x1024" | "1536x1024" | "1024x1536" | "auto";

// Download the source image and return it as a Blob the OpenAI SDK /
// multipart form can accept. Real estate photos are usually landscape
// JPEGs so we default to letting OpenAI infer the size when possible
// but force landscape for staging where the room orientation matters.
async function fetchAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not fetch source image: HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = await res.arrayBuffer();
  return new Blob([buf], { type: contentType });
}

export async function openaiEditImage(args: {
  sourceUrl: string;
  prompt: string;
  quality?: Quality;
  size?: Size;
  // Optional reference image(s) that guide the style/aesthetic of the
  // output. gpt-image-1 /v1/images/edits accepts multiple images via
  // repeated `image[]` form fields. The first image is the primary one
  // being edited; subsequent ones are visual style references.
  inspirationUrl?: string;
}): Promise<GeneratedImage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to Vercel env to enable gpt-image-1 renders."
    );
  }

  const sourceBlob = await fetchAsBlob(args.sourceUrl);

  const form = new FormData();
  form.append("model", "gpt-image-1");
  // OpenAI's /v1/images/edits accepts a single image under the `image`
  // field OR multiple images under `image[]`. We already verified
  // `image` works for the single-source path — don't break it. Only
  // switch to array form when an inspiration reference is also present.
  if (args.inspirationUrl) {
    const inspirationBlob = await fetchAsBlob(args.inspirationUrl);
    form.append("image[]", sourceBlob, "source.jpg");
    form.append("image[]", inspirationBlob, "inspiration.jpg");
  } else {
    form.append("image", sourceBlob, "source.jpg");
  }
  form.append("prompt", args.prompt);
  form.append("size", args.size ?? "1536x1024");
  form.append("n", "1");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenAI ${res.status}: ${text.slice(0, 400) || "no body"}`
    );
  }

  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const first = data?.data?.[0];
  if (!first) {
    throw new Error("OpenAI returned no image in the response");
  }

  // gpt-image-1 returns b64_json by default. Older endpoints returned
  // a URL; support both so we do not break if the response shape shifts.
  if (first.b64_json) {
    return {
      bytes: Buffer.from(first.b64_json, "base64"),
      mimeType: "image/png",
    };
  }
  if (first.url) {
    const imgRes = await fetch(first.url);
    if (!imgRes.ok) {
      throw new Error(`Could not fetch generated image: HTTP ${imgRes.status}`);
    }
    return {
      bytes: Buffer.from(await imgRes.arrayBuffer()),
      mimeType: imgRes.headers.get("content-type") || "image/png",
    };
  }
  throw new Error("OpenAI response had no b64_json or url");
}
