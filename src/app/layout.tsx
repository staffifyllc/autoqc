import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/providers/SessionProvider";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AutoQC - Real estate photo QC, automated",
  description: OG_DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "AutoQC",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
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
        <AuthProvider>{children}</AuthProvider>
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
