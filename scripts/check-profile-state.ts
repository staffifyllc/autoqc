import { prisma } from "../src/lib/db";
async function main() {
  const profile = await prisma.styleProfile.findUnique({
    where: { id: "cmpoj500o0001dt65bdeyp28m" },
    select: {
      id: true,
      name: true,
      colorTempAvg: true,
      saturationAvg: true,
      contrastAvg: true,
      styleHistogram: true,
      updatedAt: true,
      referencePhotos: true,
    },
  });
  const hist = profile?.styleHistogram as any;
  console.log(
    JSON.stringify(
      {
        id: profile?.id,
        name: profile?.name,
        refPhotoCount: profile?.referencePhotos?.length,
        colorTempAvg: profile?.colorTempAvg,
        saturationAvg: profile?.saturationAvg,
        contrastAvg: profile?.contrastAvg,
        histogramSet: Boolean(hist && hist.L),
        histogramSampleSize: hist?.sample_size,
        updatedAt: profile?.updatedAt,
      },
      null,
      2
    )
  );
}
main().finally(() => prisma.$disconnect());
