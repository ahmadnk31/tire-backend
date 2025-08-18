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
    const items = await db_1.db.query.wishlist.findMany({ where: (0, drizzle_orm_1.eq)(schema_1.wishlist.userId, userId) });
    res.json({ wishlist: items });
});
router.post('/', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const { productId } = req.body;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!productId)
        return res.status(400).json({ error: 'Missing productId' });
    const existing = await db_1.db.query.wishlist.findFirst({
        where: (row) => (0, drizzle_orm_1.eq)(row.userId, userId) && (0, drizzle_orm_1.eq)(row.productId, productId)
    });
    if (existing) {
        return res.status(200).json({ message: 'Already in wishlist' });
    }
    const inserted = await db_1.db.insert(schema_1.wishlist).values({ userId, productId }).returning();
    res.status(201).json(inserted[0]);
});
router.delete('/:productId', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const productId = parseInt(req.params.productId);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!productId)
        return res.status(400).json({ error: 'Missing productId' });
    const { and, eq } = require('drizzle-orm');
    const deleted = await db_1.db.delete(schema_1.wishlist)
        .where(and(eq(schema_1.wishlist.userId, userId), eq(schema_1.wishlist.productId, productId)))
        .returning();
    if (deleted.length === 0) {
        return res.status(404).json({ error: 'Wishlist item not found' });
    }
    res.status(204).send();
});
exports.default = router;
