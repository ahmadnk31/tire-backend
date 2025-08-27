"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const stripe_1 = __importDefault(require("stripe"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
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
    }
    catch (err) {
        console.error('Stripe payment intent creation error:', err);
        res.status(500).json({ error: err.message });
    }
});
router.post("/create-order", async (req, res) => {
    try {
        console.log('Create order request body:', req.body);
        const { paymentIntentId, cart, shippingAddress, billingAddress, userId, userEmail, userName } = req.body;
        if (!paymentIntentId || !cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ error: "Invalid request data." });
        }
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: "Payment intent is not succeeded." });
        }
        const existingOrder = await db_1.db.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.paymentIntentId, paymentIntentId));
        if (existingOrder.length > 0) {
            return res.json({ success: true, orderId: existingOrder[0].id, message: "Order already exists" });
        }
        const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);
        const total = subtotal;
        const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const [order] = await db_1.db.insert(schema_1.orders).values({
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
        for (const item of cart) {
            await db_1.db.insert(schema_1.orderItems).values({
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
    }
    catch (err) {
        console.error('Create order error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
