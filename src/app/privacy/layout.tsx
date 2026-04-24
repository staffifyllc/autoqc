import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How AutoQC collects, uses, and safeguards photographer and agency data, including photos, account info, and billing details.",
  alternates: {
    canonical: "https://www.autoqc.io/privacy",
  },
  openGraph: {
    title: "Privacy Policy — AutoQC",
    description:
      "How AutoQC handles your photos, account data, and integrations.",
    url: "https://www.autoqc.io/privacy",
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
