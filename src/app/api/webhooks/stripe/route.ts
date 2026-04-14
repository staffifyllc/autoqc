import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { fulfillCreditPurchase } from "@/lib/credits";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    // === CREDIT PURCHASES ===
    case "checkout.session.completed": {
      const session = event.data.object;
      const metadata = session.metadata;

      if (metadata?.agencyId && metadata?.credits) {
        await fulfillCreditPurchase(
          metadata.agencyId,
          parseInt(metadata.credits),
          session.amount_total || 0,
          session.payment_intent as string
        );
        console.log(
          `Credits fulfilled: ${metadata.credits} credits for agency ${metadata.agencyId}`
        );
      }
      break;
    }

    // === PAYMENT METHOD ADDED ===
    case "payment_method.attached": {
      const pm = event.data.object;
      const customerId = pm.customer as string;

      if (customerId) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          include: {
            agencies: {
              where: { role: "owner" },
            },
          },
        });

        if (user?.agencies[0]) {
          await prisma.agency.update({
            where: { id: user.agencies[0].agencyId },
            data: { hasPaymentMethod: true },
          });
        }
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      // Find user by Stripe customer ID
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        console.log(
          `Subscription ${event.type} for user ${user.id}: ${subscription.status}`
        );
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      console.log(`Invoice paid: ${invoice.id} - $${(invoice.amount_paid / 100).toFixed(2)}`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = invoice.customer as string;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        console.log(`Payment failed for user ${user.id}: ${invoice.id}`);
        // Could send notification email here
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
