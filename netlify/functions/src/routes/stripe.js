"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const stripe_1 = __importDefault(require("stripe"));
const router = express_1.default.Router();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    typescript: true,
    apiVersion: "2025-07-30.basil"
});
router.post("/create-payment-intent", async (req, res) => {
    try {
        console.log('Payment intent request body:', req.body);
        const cart = req.body.cart || [];
        const userId = req.body.userId || null;
        console.log('Cart received:', cart);
        if (!Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ error: "Cart is empty or invalid." });
        }
        const amount = cart.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const quantity = parseInt(item.quantity) || 0;
            return sum + (price * quantity);
        }, 0);
        console.log('Calculated amount:', amount);
        if (amount <= 0) {
            return res.status(400).json({ error: "Cart total must be greater than 0." });
        }
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
        console.log('Payment intent object:', paymentIntent);
        res.json({ clientSecret: paymentIntent.client_secret });
    }
    catch (err) {
        console.error('Stripe payment intent creation error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
