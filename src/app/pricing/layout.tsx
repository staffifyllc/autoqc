import type { Metadata } from "next";

// The pricing page itself is a client component, so we use this server-side
// layout to export per-page metadata. Next.js merges these with the root
// metadata and overrides duplicate fields.
export const metadata: Metadata = {
  title: "Pricing — From $8 per property",
  description:
    "AutoQC pricing for real estate photography agencies. Pay per property, no subscription required. Standard tier $8, Premium tier with privacy blur and distraction removal from $12.",
  alternates: {
    canonical: "https://www.autoqc.io/pricing",
  },
  openGraph: {
    title: "Pricing — AutoQC | From $8 per property",
    description:
      "Pay per property, no subscription. Standard tier $8, Premium tier from $12. Real estate photography QC, automated.",
    url: "https://www.autoqc.io/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
