import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";

// Per-render OpenAI cost at gpt-image-1 high quality. Used to estimate
// how much unpurchased previews cost us vs. what keepers earned. Older
// nano-banana rows (provider === "gemini") were ~$0.04 per call; we
// use a per-provider rate below.
const COST_PER_RENDER: Record<string, number> = {
  "openai-gpt-image-1": 0.17,
  "gemini": 0.04,
};
const DEFAULT_COST = 0.17;

function renderCost(provider: string | null | undefined): number {
  if (!provider) return DEFAULT_COST;
  return COST_PER_RENDER[provider] ?? DEFAULT_COST;
}

export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86_400_000);

    // Pull every staging variant row once and fan out aggregations in
    // memory. Small table (one row per preview or keeper) so this stays
    // fast even as the feature grows.
    const variants = await prisma.photoVariant.findMany({
      where: { type: { in: ["STAGING_PREVIEW", "STAGING_FINAL"] } },
      select: {
        id: true,
        photoId: true,
        type: true,
        style: true,
        provider: true,
        creditCost: true,
        createdAt: true,
        photo: {
          select: {
            id: true,
            issues: true,
            property: {
              select: {
                id: true,
                agencyId: true,
                agency: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let previewCount = 0;
    let finalCount = 0;
    let previewCost = 0;
    let finalCost = 0;
    let revenueDollars = 0;

    // Photos that have at least one preview vs at least one final. The
    // intersection is "converted photos"; previews with no final on the
    // same photo are abandoned.
    const photosWithPreview = new Set<string>();
    const photosWithFinal = new Set<string>();

    const perStyle: Record<string, { previews: number; finals: number }> = {};
    const perRoomType: Record<string, { previews: number; finals: number }> = {};
    const perAgency: Record<
      string,
      { name: string; previews: number; finals: number }
    > = {};

    // Daily bucket (YYYY-MM-DD in UTC) for a 30-day sparkline.
    const perDay: Record<string, { previews: number; finals: number }> = {};

    for (const v of variants) {
      const isPreview = v.type === "STAGING_PREVIEW";
      const cost = renderCost(v.provider);

      if (isPreview) {
        previewCount++;
        previewCost += cost;
        photosWithPreview.add(v.photoId);
      } else {
        finalCount++;
        finalCost += cost;
        revenueDollars += v.creditCost; // 1 credit == $1
        photosWithFinal.add(v.photoId);
      }

      const style = v.style ?? "unknown";
      if (!perStyle[style]) perStyle[style] = { previews: 0, finals: 0 };
      perStyle[style][isPreview ? "previews" : "finals"]++;

      const roomType = ((v.photo.issues as any)?._room_type ?? "unknown") as string;
      if (!perRoomType[roomType]) perRoomType[roomType] = { previews: 0, finals: 0 };
      perRoomType[roomType][isPreview ? "previews" : "finals"]++;

      const agencyId = v.photo.property.agencyId;
      const agencyName = v.photo.property.agency.name;
      if (!perAgency[agencyId]) {
        perAgency[agencyId] = { name: agencyName, previews: 0, finals: 0 };
      }
      perAgency[agencyId][isPreview ? "previews" : "finals"]++;

      if (v.createdAt >= d30) {
        const d = v.createdAt.toISOString().slice(0, 10);
        if (!perDay[d]) perDay[d] = { previews: 0, finals: 0 };
        perDay[d][isPreview ? "previews" : "finals"]++;
      }
    }

    const totalCost = previewCost + finalCost;
    const grossMargin = revenueDollars - totalCost;
    const conversionByPhoto =
      photosWithPreview.size > 0
        ? photosWithFinal.size / photosWithPreview.size
        : 0;
    const conversionByRender =
      previewCount + finalCount > 0
        ? finalCount / (previewCount + finalCount)
        : 0;

    // Photos that got a preview but never a final. These are the pure
    // cost sinks — someone rendered a preview and walked.
    const abandonedPhotoIds = Array.from(photosWithPreview).filter(
      (id) => !photosWithFinal.has(id)
    );
    const abandonedCost = variants
      .filter(
        (v) =>
          v.type === "STAGING_PREVIEW" && abandonedPhotoIds.includes(v.photoId)
      )
      .reduce((sum, v) => sum + renderCost(v.provider), 0);

    // Shape per-agency for the UI. Sort by previews desc so the biggest
    // cost sinks (lots of previews, few finals) float to the top.
    const agencies = Object.entries(perAgency)
      .map(([id, a]) => {
        const rate = a.previews > 0 ? a.finals / a.previews : 0;
        const cost = (a.previews + a.finals) * DEFAULT_COST;
        const revenue = a.finals * 2;
        return {
          id,
          name: a.name,
          previews: a.previews,
          finals: a.finals,
          conversionRate: rate,
          estCost: cost,
          estRevenue: revenue,
          estMargin: revenue - cost,
        };
      })
      .sort((a, b) => b.previews - a.previews);

    const styles = Object.entries(perStyle)
      .map(([style, s]) => ({
        style,
        previews: s.previews,
        finals: s.finals,
        conversionRate: s.previews > 0 ? s.finals / s.previews : 0,
      }))
      .sort((a, b) => b.previews - a.previews);

    const roomTypes = Object.entries(perRoomType)
      .map(([roomType, r]) => ({
        roomType,
        previews: r.previews,
        finals: r.finals,
        conversionRate: r.previews > 0 ? r.finals / r.previews : 0,
      }))
      .sort((a, b) => b.previews - a.previews);

    const daily = Object.entries(perDay)
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    return NextResponse.json({
      summary: {
        previewCount,
        finalCount,
        conversionByPhoto, // finals / distinct photos that saw a preview
        conversionByRender, // finals / (previews + finals)
        previewCost: Number(previewCost.toFixed(2)),
        finalCost: Number(finalCost.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        revenueDollars: Number(revenueDollars.toFixed(2)),
        grossMargin: Number(grossMargin.toFixed(2)),
        abandonedPhotoCount: abandonedPhotoIds.length,
        abandonedCost: Number(abandonedCost.toFixed(2)),
      },
      styles,
      roomTypes,
      agencies,
      daily,
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized" || e?.message === "Forbidden") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error("[admin/staging-insights]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
