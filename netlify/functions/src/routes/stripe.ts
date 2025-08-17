import express from "express";
import Stripe from "stripe";

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
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      shipping: req.body.shipping || undefined,
      metadata: {
        cart: JSON.stringify(cart),
        userId: userId || '',
        userEmail: req.body.userEmail || '',
        userName: req.body.userName || ''
      }
    });
    
    console.log('Payment intent created successfully:', paymentIntent.id);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: any) {
    console.error('Stripe payment intent creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;