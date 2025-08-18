"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.put('/', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const { name } = req.body;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    await db_1.db.update(schema_1.users).set({ name }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    res.json({ success: true });
});
router.get('/addresses', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const addresses = await db_1.db.query.userAddresses.findMany({ where: (0, drizzle_orm_1.eq)(schema_1.userAddresses.userId, userId) });
    res.json({ addresses });
});
router.post('/addresses', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const { type, street, city, state, zipCode, country } = req.body;
    if (!userId || !type || !street || !city || !state || !zipCode || !country) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    const [address] = await db_1.db.insert(schema_1.userAddresses).values({ userId, type, street, city, state, zipCode, country }).returning();
    res.json({ address });
});
router.put('/addresses/:id', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { type, street, city, state, zipCode, country } = req.body;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const address = await db_1.db.query.userAddresses.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.userAddresses.id, Number(id)) });
    if (!address || address.userId !== userId)
        return res.status(404).json({ error: 'Address not found' });
    await db_1.db.update(schema_1.userAddresses).set({ type, street, city, state, zipCode, country }).where((0, drizzle_orm_1.eq)(schema_1.userAddresses.id, Number(id)));
    const updated = await db_1.db.query.userAddresses.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.userAddresses.id, Number(id)) });
    res.json({ address: updated });
});
router.delete('/addresses/:id', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const address = await db_1.db.query.userAddresses.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.userAddresses.id, Number(id)) });
    if (!address || address.userId !== userId)
        return res.status(404).json({ error: 'Address not found' });
    await db_1.db.delete(schema_1.userAddresses).where((0, drizzle_orm_1.eq)(schema_1.userAddresses.id, Number(id)));
    res.json({ success: true });
});
router.get('/addresses/default', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    let type = req.query.type || 'shipping';
    if (Array.isArray(type))
        type = type[0];
    if (typeof type !== 'string')
        type = 'shipping';
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const address = await db_1.db.query.userAddresses.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userAddresses.userId, userId), (0, drizzle_orm_1.eq)(schema_1.userAddresses.type, type), (0, drizzle_orm_1.eq)(schema_1.userAddresses.isDefault, true))
    });
    if (!address) {
        const anyAddress = await db_1.db.query.userAddresses.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userAddresses.userId, userId), (0, drizzle_orm_1.eq)(schema_1.userAddresses.type, type))
        });
        return res.json({ address: anyAddress || null });
    }
    res.json({ address });
});
exports.default = router;
