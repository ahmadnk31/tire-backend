"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const stripe_1 = __importDefault(require("stripe"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = express_1.default.Router();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-07-30.basil"
});
router.post("/webhook/stripe", express_1.default.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata || {};
        const userId = metadata.userId ? parseInt(metadata.userId) : null;
        const userEmail = metadata.userEmail || null;
        const userName = metadata.userName || null;
        const cart = metadata.cart ? JSON.parse(metadata.cart) : [];
        const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const [order] = await db_1.db.insert(schema_1.orders).values({
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
        for (const item of cart) {
            await db_1.db.insert(schema_1.orderItems).values({
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
exports.default = router;
