import express from "express";
import Stripe from "stripe";
import { db } from "../db";
import { orders, orderItems } from "../db/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
  apiVersion:"2025-07-30.basil"
});

router.post("/create-payment-intent", async (req, res) => {
  try {
    console.log('Payment intent request body:', req.body);
    
    const cart = req.body.cart || [];
    const userId = req.body.userId || null;
    
    console.log('Cart received:', cart);
    
    // Validate cart
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Cart is empty or invalid." });
    }
    
    // Calculate order amount from cart
    const amount = cart.reduce((sum: number, item: any) => {
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return sum + (price * quantity);
    }, 0);
    
    console.log('Calculated amount:', amount);
    
    if (amount <= 0) {
      return res.status(400).json({ error: "Cart total must be greater than 0." });
    }
    
    // Stripe expects amount in cents
    const amountInCents = Math.round(amount * 100);
    console.log('Amount in cents:', amountInCents);
    
    console.log('📦 Creating payment intent with metadata:', {
      cart: cart.length,
      userId,
      userEmail: req.body.userEmail,
      userName: req.body.userName,
      shippingAddress: req.body.shippingAddress ? 'Present' : 'Missing',
      billingAddress: req.body.billingAddress ? 'Present' : 'Missing'
    });
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      shipping: req.body.shipping || undefined,
      metadata: {
        cart: JSON.stringify(cart),
        userId: userId || '',
        userEmail: req.body.userEmail || '',
        userName: req.body.userName || '',
        shippingAddress: req.body.shippingAddress ? JSON.stringify(req.body.shippingAddress) : '',
        billingAddress: req.body.billingAddress ? JSON.stringify(req.body.billingAddress) : ''
      }
    });
    
    console.log('Payment intent created successfully:', paymentIntent.id);
    console.log('Payment intent object:', paymentIntent);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: any) {
    console.error('Stripe payment intent creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback endpoint to create order after successful payment
router.post("/create-order", async (req, res) => {
  try {
    console.log('Create order request body:', req.body);
    
    const { paymentIntentId, cart, shippingAddress, billingAddress, userId, userEmail, userName } = req.body;
    
    if (!paymentIntentId || !cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Invalid request data." });
    }
    
    // Verify payment intent exists and is succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: "Payment intent is not succeeded." });
    }
    
    // Check if order already exists
    const existingOrder = await db.select().from(orders).where(eq(orders.paymentIntentId, paymentIntentId));
    if (existingOrder.length > 0) {
      return res.json({ success: true, orderId: existingOrder[0].id, message: "Order already exists" });
    }
    
    // Calculate totals
    const subtotal = cart.reduce((sum: number, item: any) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);
    const total = subtotal; // No tax or shipping for now
    
    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Create order
    const [order] = await db.insert(orders).values({
      orderNumber,
      paymentIntentId,
      userId: userId ? parseInt(userId) : null,
      userEmail: userEmail || "",
      userName: userName || "",
      status: "processing",
      paymentStatus: "paid",
      subtotal: subtotal.toString(),
      tax: "0",
      shipping: "0",
      total: total.toString(),
      shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
      billingAddress: billingAddress ? JSON.stringify(billingAddress) : null,
    }).returning();
    
    // Create order items
    for (const item of cart) {
      await db.insert(orderItems).values({
        orderId: order.id,
        productId: item.id,
        productName: item.name,
        productSize: item.size,
        productSku: item.sku || `SKU-${item.id}`,
        quantity: item.quantity,
        unitPrice: item.price.toString(),
        totalPrice: (parseFloat(item.price) * parseInt(item.quantity)).toString(),
      });
    }
    
    console.log('Order created successfully:', order.id);
    res.json({ success: true, orderId: order.id });
  } catch (err: any) {
    console.error('Create order error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;