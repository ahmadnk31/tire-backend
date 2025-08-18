"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const items = await db_1.db.query.cartItems.findMany({ where: (0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId) });
    res.json({ cart: items });
});
router.post('/', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const { productId, quantity, size } = req.body;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!productId || !quantity)
        return res.status(400).json({ error: 'Missing productId or quantity' });
    const existing = await db_1.db.query.cartItems.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId), (0, drizzle_orm_1.eq)(schema_1.cartItems.productId, productId)),
    });
    if (existing) {
        const updated = await db_1.db.update(schema_1.cartItems)
            .set({ quantity, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.cartItems.id, existing.id))
            .returning();
        return res.json(updated[0]);
    }
    else {
        const inserted = await db_1.db.insert(schema_1.cartItems).values({ sessionId: 'user', userId, productId, quantity, createdAt: new Date(), updatedAt: new Date() }).returning();
        return res.status(201).json(inserted[0]);
    }
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const id = parseInt(req.params.id);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!id)
        return res.status(400).json({ error: 'Missing cart item id' });
    const deleted = await db_1.db.delete(schema_1.cartItems).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.cartItems.id, id), (0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId))).returning();
    if (deleted.length === 0) {
        return res.status(404).json({ error: 'Cart item not found' });
    }
    res.status(204).send();
});
router.delete('/', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    await db_1.db.delete(schema_1.cartItems).where((0, drizzle_orm_1.eq)(schema_1.cartItems.userId, userId));
    res.status(204).send();
});
exports.default = router;
