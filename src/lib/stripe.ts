import Stripe from "stripe";
import { prisma } from "./db";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
});

export async function createCustomer(email: string, name?: string) {
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
  });
  return customer;
}

export async function createCheckoutSession(
  customerId: string,
  returnUrl: string
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
}

// Legacy function - kept for API compatibility. New code uses credits.ts
export async function recordPropertyUsage(
  agencyId: string,
  propertyId: string,
  photoCount: number
) {
  // This function is deprecated. Use chargeForProperty from credits.ts instead.
  const record = await prisma.usageRecord.create({
    data: {
      agencyId,
      propertyId,
      photoCount,
      tierPrice: 1000,
      billingMode: "CREDITS",
      creditsUsed: 1,
    },
  });
  return record;
}
