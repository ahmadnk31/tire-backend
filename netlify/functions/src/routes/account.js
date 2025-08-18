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
    const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.id, userId) });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    res.json({ user });
});
router.put('/', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const { name, email } = req.body;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!name && !email)
        return res.status(400).json({ error: 'Nothing to update' });
    try {
        const updateData = {};
        if (name)
            updateData.name = name;
        if (email)
            updateData.email = email;
        await db_1.db.update(schema_1.users).set(updateData).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.id, userId) });
        res.json({ user });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update profile', details: err?.message || err });
    }
});
router.post('/change-password', auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!currentPassword || !newPassword)
        return res.status(400).json({ error: 'Missing fields' });
    const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.id, userId) });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid)
        return res.status(400).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await db_1.db.update(schema_1.users).set({ password: hashed }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    res.json({ success: true });
});
exports.default = router;
