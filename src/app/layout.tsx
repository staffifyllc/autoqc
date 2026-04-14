import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/providers/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AutoQC - Automated Real Estate Photo Quality Control",
  description:
    "AI-powered quality control for real estate photography. Auto-detect and fix verticals, color, exposure, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(222 47% 8%)",
              border: "1px solid hsl(217 33% 17%)",
              color: "hsl(210 40% 98%)",
            },
          }}
        />
      </body>
    </html>
  );
}
