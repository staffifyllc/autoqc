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

export const metadata: Metadata = {
  title: "AutoQC - Real estate photo QC, automated",
  description:
    "AI-powered quality control for real estate photography. Auto-detect and fix verticals, color, exposure, and more.",
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
