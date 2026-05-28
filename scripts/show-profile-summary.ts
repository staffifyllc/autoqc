import { prisma } from "../src/lib/db";

async function main() {
  const profile = await prisma.styleProfile.findFirst({
    where: { name: "Flylisted Default" },
    select: {
      id: true,
      name: true,
      referencePhotos: true,
      styleHistogram: true,
      updatedAt: true,
      agency: { select: { name: true } },
    },
  });
  if (!profile) {
    console.log("No Flylisted Default profile found");
    return;
  }
  const hist = profile.styleHistogram as any;
  console.log("Profile:", profile.name, "for agency:", profile.agency.name);
  console.log("References uploaded:", profile.referencePhotos.length);
  console.log("Histogram sample_size:", hist?.sample_size);
  console.log("L_count (photos that contributed L percentiles):", hist?.L_count);
  console.log("");
  console.log("L channel learned percentiles (every 10th, 0=shadows, 99=highlights):");
  if (hist?.L) {
    const Ls = hist.L as number[];
    for (let i = 0; i < Ls.length; i += 10) {
      console.log(`  P${i + 1}: ${Ls[i].toFixed(1)}`);
    }
  }
  console.log("");
  console.log("Profile last updated:", profile.updatedAt);
}
main().catch(console.error).finally(() => prisma.$disconnect());
