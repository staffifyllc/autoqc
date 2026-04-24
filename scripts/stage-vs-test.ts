/**
 * Run the hardened staging prompt on all eligible photos in Paul's
 * "VS test 1" property. Writes renders to /tmp/vs-test-1/ grouped by
 * photo + style.
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { getDownloadUrl } from "../src/lib/s3";
import { geminiEditImage } from "../src/lib/gemini";
import {
  buildStagingPrompt,
  ELIGIBLE_STAGING_ROOM_TYPES,
  STAGING_STYLES,
  type StagingStyleId,
} from "../src/lib/staging";

const OUT_DIR = "/tmp/vs-test-1";

// Pick the set of styles to render. Start with 2 to keep cost bounded,
// bump to all 6 if Paul wants.
const STYLES_TO_RUN: StagingStyleId[] = ["modern", "traditional"];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const prisma = new PrismaClient();
  try {
    const property = await prisma.property.findFirst({
      where: {
        address: { contains: "VS test 1", mode: "insensitive" },
      },
      include: {
        photos: {
          select: {
            id: true,
            fileName: true,
            s3KeyOriginal: true,
            s3KeyFixed: true,
            useOriginal: true,
            issues: true,
            status: true,
          },
        },
      },
    });
    if (!property) {
      console.error('Property "VS test 1" not found.');
      process.exit(1);
    }
    console.log(`Property: ${property.address} (${property.id})`);
    console.log(`Photos:   ${property.photos.length}`);

    const eligible = property.photos
      .map((p) => ({
        p,
        roomType: (p.issues as any)?._room_type as string | undefined,
      }))
      .filter(({ roomType }) =>
        roomType ? ELIGIBLE_STAGING_ROOM_TYPES.has(roomType) : false
      );
    console.log(`Eligible for staging: ${eligible.length}`);
    console.log();
    for (const e of eligible) {
      console.log(`  - ${e.p.fileName} (${e.roomType}) status=${e.p.status}`);
    }
    console.log();

    for (const e of eligible) {
      const sourceKey =
        e.p.useOriginal || !e.p.s3KeyFixed
          ? e.p.s3KeyOriginal
          : e.p.s3KeyFixed;
      const sourceUrl = await getDownloadUrl(sourceKey);

      for (const style of STYLES_TO_RUN) {
        const prompt = buildStagingPrompt({
          roomType: e.roomType!,
          style,
        });
        const stem = e.p.fileName.replace(/\.[^.]+$/, "");
        const out = `${OUT_DIR}/${stem}__${e.roomType}__${style}.jpg`;
        console.log(`[${style}/${e.roomType}] ${e.p.fileName}`);
        const t0 = Date.now();
        try {
          const { bytes, mimeType } = await geminiEditImage({
            sourceUrl,
            prompt,
          });
          writeFileSync(out, bytes);
          const dt = ((Date.now() - t0) / 1000).toFixed(1);
          console.log(`  -> ${out} (${dt}s, ${bytes.length}B)`);
        } catch (err: any) {
          console.error(`  FAIL: ${err.message}`);
        }
      }
    }

    console.log();
    console.log(`open ${OUT_DIR}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
