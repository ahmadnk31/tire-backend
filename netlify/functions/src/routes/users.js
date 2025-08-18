"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    try {
        const total = await index_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users);
        const data = await index_1.db.select().from(schema_1.users).limit(limit).offset(offset);
        res.json({
            users: data,
            page,
            limit,
            total: total[0]?.count || 0,
            totalPages: Math.ceil((total[0]?.count || 0) / limit)
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
router.get('/stats/summary', async (req, res) => {
    try {
        const total = await index_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users);
        const active = await index_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.isActive, true));
        const admins = await index_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.role, 'admin'));
        res.json({
            total: total[0]?.count || 0,
            active: active[0]?.count || 0,
            admins: admins[0]?.count || 0
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});
exports.default = router;
