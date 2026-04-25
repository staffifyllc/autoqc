import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Program",
  description:
    "AutoQC's affiliate program. Application-only, recurring revenue share for partners who bring real estate photographers and agencies to AutoQC.",
  alternates: { canonical: "https://www.autoqc.io/affiliates" },
  openGraph: {
    title: "AutoQC Affiliates",
    description:
      "Application-only affiliate program for real estate photo industry creators and operators.",
    url: "https://www.autoqc.io/affiliates",
  },
};

export default function AffiliatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
