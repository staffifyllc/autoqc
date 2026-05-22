import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Renderings · AutoQC",
  description:
    "Watch raw photos turn into delivery-ready listing renderings. Color, verticals, virtual staging, virtual twilight - rendered in seconds.",
  openGraph: {
    title: "Renderings · AutoQC",
    description:
      "Watch raw photos turn into delivery-ready listing renderings. Color, verticals, virtual staging, virtual twilight - rendered in seconds.",
    images: ["/og.jpg"],
  },
  alternates: { canonical: "https://www.autoqc.io/renderings" },
};

export default function RenderingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
