import Stripe from "stripe";
import { prisma } from "./db";
import { getPropertyTier } from "./utils";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
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

export async function recordPropertyUsage(
  agencyId: string,
  propertyId: string,
  photoCount: number
) {
  const { priceCents } = getPropertyTier(photoCount);

  // Get the agency owner's Stripe customer ID
  const owner = await prisma.agencyMember.findFirst({
    where: { agencyId, role: "owner" },
    include: { user: true },
  });

  if (!owner?.user.stripeCustomerId) {
    // Free tier - check if under 3 properties this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyCount = await prisma.usageRecord.count({
      where: {
        agencyId,
        createdAt: { gte: startOfMonth },
      },
    });

    if (monthlyCount >= 3) {
      throw new Error("Free tier limit reached. Add a payment method to continue.");
    }
  }

  // Record usage
  const record = await prisma.usageRecord.create({
    data: {
      agencyId,
      propertyId,
      photoCount,
      tierPrice: priceCents,
    },
  });

  // If customer has Stripe, report usage
  if (owner?.user.stripeCustomerId) {
    try {
      await stripe.billing.meterEvents.create({
        event_name: "property_processed",
        payload: {
          stripe_customer_id: owner.user.stripeCustomerId,
          value: String(priceCents),
        },
      });
    } catch (err) {
      console.error("Failed to report Stripe usage:", err);
    }
  }

  return record;
}
