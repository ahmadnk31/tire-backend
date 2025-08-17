import express from "express";
import Stripe from "stripe";
import { db } from "../db";
import { orders, orderItems } from "../db/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil"
});

// Stripe webhook endpoint
router.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const metadata = paymentIntent.metadata || {};
    const userId = metadata.userId ? parseInt(metadata.userId) : null;
    const userEmail = metadata.userEmail || null;
    const userName = metadata.userName || null;
    const cart = metadata.cart ? JSON.parse(metadata.cart) : [];
    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    // Save order in DB
    const [order] = await db.insert(orders).values({
      orderNumber,
      userId,
      userEmail: userEmail || "",
      userName: userName || "",
      status: "processing",
      paymentStatus: "paid",
      subtotal: (paymentIntent.amount / 100).toString(),
      tax: "0",
      shipping: "0",
      total: (paymentIntent.amount / 100).toString(),
      shippingAddress: metadata.shippingAddress ? JSON.parse(metadata.shippingAddress) : null,
      billingAddress: metadata.billingAddress ? JSON.parse(metadata.billingAddress) : null,
    }).returning();
    // Save order items
    for (const item of cart) {
      await db.insert(orderItems).values({
        orderId: order.id,
        productId: item.id,
        productName: item.name,
        productSize: item.size,
        productSku: item.sku || `SKU-${item.id}`,
        quantity: item.quantity,
        unitPrice: item.price.toString(),
        totalPrice: (item.price * item.quantity).toString(),
      });
    }
  }

  res.json({ received: true });
});

export default router;
