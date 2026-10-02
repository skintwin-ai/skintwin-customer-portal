import express, { Request, Response, Router } from "express";
import type Stripe from "stripe";
import * as db from "./db";
import { constructWebhookEvent } from "./integrations/stripe";
import { recordPaymentIntentSettlement, recordInvoiceSettlement, recordCheckoutSettlement, acceptChargeReturn, acceptChargeStoredReturns } from "./supplyChain";

export function createStripeWebhookRouter(): Router {
  const router = Router();

  router.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret || typeof signature !== "string") {
        res.status(400).json({ error: "Webhook secret not configured" });
        return;
      }

      let event: Stripe.Event;
      try {
        const payload = Buffer.isBuffer(req.body) ? req.body : req.body;
        event = constructWebhookEvent(payload, signature, webhookSecret);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "invalid signature";
        res.status(400).json({ error: `Webhook Error: ${message}` });
        return;
      }

      try {
        if (event.type === "payment_intent.succeeded") {
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        } else if (event.type === "payment_intent.payment_failed") {
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        } else if (event.type === "charge.refunded") {
          await handleChargeRefunded(event.data.object as Stripe.Charge);
        } else if (event.type === "invoice.paid") {
          await handleInvoicePaid(event.data.object as Stripe.Invoice);
        } else if (event.type === "checkout.session.completed") {
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "webhook failed";
        console.error(`[Stripe Webhook] Error processing ${event.type}:`, message);
      }

      res.json({ received: true });
    },
  );

  return router;
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const settled = recordPaymentIntentSettlement(paymentIntent);
  if (!settled.ok) {
    throw new Error(settled.error);
  }

  const payment = await db.getPaymentByProcessorId(paymentIntent.id);
  if (!payment) return;
  const chargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : undefined;
  await db.updatePayment(payment.id, {
    status: "succeeded",
    ...(chargeId ? { processorChargeId: chargeId } : {}),
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const payment = await db.getPaymentByProcessorId(paymentIntent.id);
  if (payment) {
    await db.updatePayment(payment.id, { status: "failed" });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const settled = recordInvoiceSettlement(invoice);
  if (!settled.ok) {
    throw new Error(settled.error);
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const settled = recordCheckoutSettlement(session);
  if (!settled.ok) {
    throw new Error(settled.error);
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const returned = acceptChargeReturn(charge);
  if (!returned.ok) {
    throw new Error(returned.error);
  }
  const paymentIntent = charge.payment_intent;
  const processorId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id || charge.id;
  const payment = await db.getPaymentByProcessorId(processorId);
  if (charge.refunded === true && returned.count === 0) {
    const order = payment?.orderId ? await db.getOrderById(payment.orderId) : undefined;
    const stored = acceptChargeStoredReturns(
      charge,
      order?.orderNumber,
      order ? await db.getOrderItems(order.id) : [],
    );
    if (!stored.ok) {
      throw new Error(stored.error);
    }
  }
  if (!payment) return;
  await db.updatePayment(payment.id, {
    status: charge.refunded ? "refunded" : "partially_refunded",
  });
}
