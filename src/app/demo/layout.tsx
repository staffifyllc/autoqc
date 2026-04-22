import type { Metadata } from "next";

// Server-side layout for the demo page, which itself is a client component.
// Lets us set per-page metadata without refactoring the demo into a server
// component.
export const metadata: Metadata = {
  title: "Try AutoQC — See AI Photo QC in Action",
  description:
    "Upload a real estate photo and watch AutoQC grade it in real time. Twelve QC checks, auto-fixes for verticals and color, composition audit by Claude Vision. No account needed.",
  alternates: {
    canonical: "https://www.autoqc.io/demo",
  },
  openGraph: {
    title: "Try the AutoQC Demo — AI Real Estate Photo QC",
    description:
      "Upload a real estate photo, watch AutoQC grade it and auto-fix issues in real time. No account needed.",
    url: "https://www.autoqc.io/demo",
  },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
