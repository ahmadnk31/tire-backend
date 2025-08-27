import express from "express";
import Stripe from "stripe";
import { db } from "../db";
import { orders, orderItems } from "../db/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil"
});

// Test endpoint to verify webhook is accessible
router.get("/webhook/test", (req, res) => {
  console.log('🔔 [WEBHOOK] Test endpoint hit');
  res.json({ message: "Webhook endpoint is accessible", timestamp: new Date().toISOString() });
});

// Stripe webhook endpoint
router.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  console.log('🔔 [WEBHOOK] Received Stripe webhook');
  console.log('🔔 [WEBHOOK] Headers:', req.headers);
  console.log('🔔 [WEBHOOK] Body length:', req.body?.length || 0);
  
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
    console.log('🔔 [WEBHOOK] Event type:', event.type);
  } catch (err: any) {
    console.error('❌ [WEBHOOK] Error constructing event:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    try {
      console.log('🔔 [WEBHOOK] Processing payment_intent.succeeded');
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('🔔 [WEBHOOK] Payment Intent ID:', paymentIntent.id);
      console.log('🔔 [WEBHOOK] Amount:', paymentIntent.amount);
      console.log('🔔 [WEBHOOK] Metadata:', paymentIntent.metadata);
      
      const metadata = paymentIntent.metadata || {};
      const userId = metadata.userId ? parseInt(metadata.userId) : null;
      const userEmail = metadata.userEmail || null;
      const userName = metadata.userName || null;
      const cart = metadata.cart ? JSON.parse(metadata.cart) : [];
      
      console.log('🔔 [WEBHOOK] Parsed data:', { userId, userEmail, userName, cartLength: cart.length });
      
      if (cart.length === 0) {
        console.error('❌ [WEBHOOK] No cart items found in metadata');
        return res.json({ received: true, error: 'No cart items' });
      }
      
      // Parse shipping and billing addresses if available
      let shippingAddress = null;
      let billingAddress = null;
      
      try {
        if (metadata.shippingAddress) {
          shippingAddress = JSON.parse(metadata.shippingAddress);
          console.log('🔔 [WEBHOOK] Shipping address parsed:', shippingAddress);
        }
        if (metadata.billingAddress) {
          billingAddress = JSON.parse(metadata.billingAddress);
          console.log('🔔 [WEBHOOK] Billing address parsed:', billingAddress);
        }
      } catch (error) {
        console.error('❌ [WEBHOOK] Error parsing addresses:', error);
      }
      
      // Generate unique order number and tracking number
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const trackingNumber = `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Save order in DB
      console.log('🔔 [WEBHOOK] Creating order with number:', orderNumber);
      console.log('🔔 [WEBHOOK] Tracking number:', trackingNumber);
      const [order] = await db.insert(orders).values({
        orderNumber,
        paymentIntentId: paymentIntent.id,
        userId,
        userEmail: userEmail || "",
        userName: userName || "",
        status: "processing",
        paymentStatus: "paid",
        subtotal: (paymentIntent.amount / 100).toString(),
        tax: "0",
        shipping: "0",
        total: (paymentIntent.amount / 100).toString(),
        shippingAddress: shippingAddress,
        billingAddress: billingAddress,
        trackingNumber: trackingNumber,

      }).returning();
      console.log('🔔 [WEBHOOK] Order created with ID:', order.id);
      
      // Save order items
      console.log('🔔 [WEBHOOK] Creating order items for', cart.length, 'items');
      for (const item of cart) {
        console.log('🔔 [WEBHOOK] Creating order item for:', item.name);
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
      console.log('🔔 [WEBHOOK] Order and items created successfully');
    } catch (error) {
      console.error('❌ [WEBHOOK] Error processing payment_intent.succeeded:', error);
      return res.status(500).json({ received: true, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  res.json({ received: true });
});

export default router;
