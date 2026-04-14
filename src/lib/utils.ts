import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function getPropertyTier(photoCount: number): {
  tier: string;
  priceCents: number;
} {
  if (photoCount <= 30) return { tier: "base", priceCents: 1000 };
  if (photoCount <= 60) return { tier: "medium", priceCents: 1500 };
  return { tier: "large", priceCents: 2000 };
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}
