import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { AuthProvider } from "@/components/providers/SessionProvider";
import { JsonLd } from "@/components/JsonLd";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = "https://www.autoqc.io";
const OG_TITLE = "AutoQC. The final checkpoint before delivery.";
const OG_DESCRIPTION =
  "Catch what your editors miss, before your agent does. A twelve-point audit on every property before it reaches the client. Verticals, color, privacy blur, distraction removal. From $8 per property.";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AutoQC — AI Real Estate Photo QC | Catch What Editors Miss",
    template: "%s | AutoQC",
  },
  description: OG_DESCRIPTION,
  applicationName: "AutoQC",
  keywords: [
    "real estate photo QC",
    "real estate photography quality control",
    "AI photo editing for realtors",
    "automated real estate photo editing",
    "MLS photo audit",
    "real estate photography workflow",
    "AutoHDR alternative",
    "photo verticals correction",
    "real estate listing photos",
  ],
  authors: [{ name: "AutoQC" }],
  creator: "AutoQC",
  publisher: "AutoQC",
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "AutoQC",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "AutoQC. Catch what your editors miss, before your agent does.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: ["/og.jpg"],
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className={`${inter.className} font-sans`}>
        <JsonLd />
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "hsl(220 10% 11%)",
              border: "1px solid hsl(220 8% 17%)",
              color: "hsl(30 6% 96%)",
              borderRadius: "0.625rem",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
