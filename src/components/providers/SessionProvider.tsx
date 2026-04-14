"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { UploadProvider } from "@/lib/upload/UploadContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <UploadProvider>{children}</UploadProvider>
    </SessionProvider>
  );
}
