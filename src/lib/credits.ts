import { prisma } from "./db";
import { stripe } from "./stripe";

// Credit packages - buy more, save more
export const CREDIT_PACKAGES = [
  {
    id: "credits_10",
    name: "Starter",
    credits: 10,
    priceCents: 10000, // $100 total, $10/credit
    savingsPct: 0,
  },
  {
    id: "credits_25",
    name: "Professional",
    credits: 25,
    priceCents: 22500, // $225 total, $9/credit (save $25)
    savingsPct: 10,
  },
  {
    id: "credits_50",
    name: "Agency",
    credits: 50,
    priceCents: 42500, // $425 total, $8.50/credit (save $75)
    savingsPct: 15,
  },
  {
    id: "credits_100",
    name: "Scale",
    credits: 100,
    priceCents: 80000, // $800 total, $8/credit (save $200)
    savingsPct: 20,
  },
];

// Pricing
export const CREDIT_PRICE_CENTS = 1000; // $10 per credit
export const PAYG_STANDARD_CENTS = 1200; // $12 / standard property
export const PAYG_PREMIUM_CENTS = 2000; // $20 / premium property
export const PAYG_PRICE_CENTS = PAYG_STANDARD_CENTS; // backward compat

// Credit costs per property tier
export const CREDITS_PER_PROPERTY = {
  STANDARD: 1,
  PREMIUM: 2,
} as const;

export function creditsForTier(tier: "STANDARD" | "PREMIUM"): number {
  return CREDITS_PER_PROPERTY[tier] || 1;
}

export function paygPriceForTier(tier: "STANDARD" | "PREMIUM"): number {
  return tier === "PREMIUM" ? PAYG_PREMIUM_CENTS : PAYG_STANDARD_CENTS;
}

/**
 * Check if an agency has sufficient means to process a property.
 * Returns { canProcess: boolean, method: 'credits' | 'payg' | null, reason?: string }
 */
export async function checkPaymentCapability(agencyId: string) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      creditBalance: true,
      hasPaymentMethod: true,
      billingMode: true,
      isAdmin: true,
    },
  });

  if (!agency) {
    return { canProcess: false, method: null, reason: "Agency not found" };
  }

  // Admin agencies bypass all payment checks
  if (agency.isAdmin) {
    return { canProcess: true, method: "admin" as const };
  }

  // Check credits first
  if (agency.creditBalance > 0) {
    return { canProcess: true, method: "credits" as const };
  }

  // Fall back to PAYG if they have a payment method
  if (agency.hasPaymentMethod) {
    return { canProcess: true, method: "payg" as const };
  }

  return {
    canProcess: false,
    method: null,
    reason:
      "No credits available and no payment method on file. Purchase credits or add a payment method to continue.",
  };
}

/**
 * Charge for processing a property. Deducts credit or charges card.
 * Called BEFORE QC runs to ensure payment first.
 */
export async function chargeForProperty(
  agencyId: string,
  propertyId: string,
  photoCount: number
): Promise<{ success: boolean; method: string; error?: string }> {
  const capability = await checkPaymentCapability(agencyId);

  if (!capability.canProcess) {
    return {
      success: false,
      method: "none",
      error: capability.reason || "Payment required",
    };
  }

  // Determine how many credits this property costs based on tier
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { tier: true },
  });
  const tier = (property?.tier || "STANDARD") as "STANDARD" | "PREMIUM";
  const creditsNeeded = creditsForTier(tier);
  const paygCents = paygPriceForTier(tier);

  // Admin accounts: track usage but don't charge
  if (capability.method === "admin") {
    await prisma.usageRecord.create({
      data: {
        agencyId,
        propertyId,
        photoCount,
        tierPrice: 0,
        billingMode: "CREDITS",
        creditsUsed: 0,
      },
    });
    return { success: true, method: "admin" };
  }

  if (capability.method === "credits") {
    // Check they have enough credits for this tier
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { creditBalance: true },
    });
    if (!agency || agency.creditBalance < creditsNeeded) {
      return {
        success: false,
        method: "credits",
        error: `${tier} tier requires ${creditsNeeded} credits. You have ${
          agency?.creditBalance || 0
        }. Buy more credits or switch this property to Standard tier.`,
      };
    }

    try {
      await prisma.$transaction([
        prisma.agency.update({
          where: { id: agencyId },
          data: { creditBalance: { decrement: creditsNeeded } },
        }),
        prisma.creditTransaction.create({
          data: {
            agencyId,
            type: "USAGE",
            amount: -creditsNeeded,
            description: `${tier} property processed: ${propertyId}`,
          },
        }),
        prisma.usageRecord.create({
          data: {
            agencyId,
            propertyId,
            photoCount,
            tierPrice: CREDIT_PRICE_CENTS * creditsNeeded,
            billingMode: "CREDITS",
            creditsUsed: creditsNeeded,
          },
        }),
      ]);
      return { success: true, method: "credits" };
    } catch (err) {
      return {
        success: false,
        method: "credits",
        error: "Failed to deduct credits",
      };
    }
  }

  if (capability.method === "payg") {
    // Charge the card via Stripe
    try {
      const owner = await prisma.agencyMember.findFirst({
        where: { agencyId, role: "owner" },
        include: { user: true },
      });

      if (!owner?.user.stripeCustomerId) {
        return {
          success: false,
          method: "payg",
          error: "No Stripe customer ID found",
        };
      }

      const charge = await stripe.paymentIntents.create({
        amount: paygCents,
        currency: "usd",
        customer: owner.user.stripeCustomerId,
        description: `AutoQC ${tier} property processing: ${propertyId}`,
        confirm: true,
        off_session: true,
        payment_method: undefined, // Use default
      });

      if (charge.status !== "succeeded") {
        return {
          success: false,
          method: "payg",
          error: `Payment failed: ${charge.status}`,
        };
      }

      await prisma.usageRecord.create({
        data: {
          agencyId,
          propertyId,
          photoCount,
          tierPrice: paygCents,
          billingMode: "PAY_AS_YOU_GO",
          creditsUsed: 0,
          stripeChargeId: charge.id,
        },
      });

      return { success: true, method: "payg" };
    } catch (err: any) {
      return {
        success: false,
        method: "payg",
        error: err.message || "Stripe charge failed",
      };
    }
  }

  return { success: false, method: "none", error: "Unknown payment method" };
}

/**
 * Refund credits if processing failed (e.g., Lambda crash)
 */
export async function refundForProperty(
  agencyId: string,
  propertyId: string,
  reason: string
) {
  const record = await prisma.usageRecord.findFirst({
    where: { agencyId, propertyId },
  });

  if (!record) return;

  if (record.billingMode === "CREDITS") {
    await prisma.$transaction([
      prisma.agency.update({
        where: { id: agencyId },
        data: { creditBalance: { increment: record.creditsUsed } },
      }),
      prisma.creditTransaction.create({
        data: {
          agencyId,
          type: "REFUND",
          amount: record.creditsUsed,
          description: `Refund: ${reason}`,
        },
      }),
    ]);
  } else if (record.stripeChargeId) {
    // Refund the Stripe charge
    await stripe.refunds.create({
      payment_intent: record.stripeChargeId,
      reason: "requested_by_customer",
    });
  }
}

/**
 * Purchase a credit package via Stripe Checkout
 */
export async function createCreditPurchaseSession(
  agencyId: string,
  packageId: string,
  successUrl: string,
  cancelUrl: string
) {
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new Error("Invalid package");

  const owner = await prisma.agencyMember.findFirst({
    where: { agencyId, role: "owner" },
    include: { user: true },
  });

  if (!owner) throw new Error("Agency owner not found");

  // Create or get Stripe customer
  let customerId = owner.user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: owner.user.email,
      name: owner.user.name || undefined,
      metadata: { agencyId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: owner.userId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${pkg.name} - ${pkg.credits} AutoQC Credits`,
            description: `${pkg.credits} property processing credits. Never expires.`,
          },
          unit_amount: pkg.priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      agencyId,
      packageId,
      credits: String(pkg.credits),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

/**
 * Called from Stripe webhook after successful payment
 * Adds credits to agency balance
 */
export async function fulfillCreditPurchase(
  agencyId: string,
  credits: number,
  priceCents: number,
  stripeChargeId: string
) {
  await prisma.$transaction([
    prisma.agency.update({
      where: { id: agencyId },
      data: {
        creditBalance: { increment: credits },
        totalCreditsPurchased: { increment: credits },
      },
    }),
    prisma.creditTransaction.create({
      data: {
        agencyId,
        type: "PURCHASE",
        amount: credits,
        priceCents,
        stripeChargeId,
        description: `Purchased ${credits} credits`,
      },
    }),
  ]);
}
