import express from 'express';
import { db } from '../db/index';
import { users } from '../db/schema';
import { eq, count } from 'drizzle-orm';

const router = express.Router();

// GET /api/users?page=1&limit=10
router.get('/', async (req, res) => {
	const page = parseInt(req.query.page as string) || 1;
	const limit = parseInt(req.query.limit as string) || 10;
	const offset = (page - 1) * limit;

	try {
		const total = await db.select({ count: count() }).from(users);
		const data = await db.select().from(users).limit(limit).offset(offset);
		res.json({
			users: data,
			page,
			limit,
			total: total[0]?.count || 0,
			totalPages: Math.ceil((total[0]?.count || 0) / limit)
		});
	} catch (err) {
		res.status(500).json({ error: 'Failed to fetch users' });
	}
});

// GET /api/users/stats/summary
router.get('/stats/summary', async (req, res) => {
	try {
		const total = await db.select({ count: count() }).from(users);
		const active = await db.select({ count: count() }).from(users).where(eq(users.isActive, true));
		const admins = await db.select({ count: count() }).from(users).where(eq(users.role, 'admin'));
		res.json({
			total: total[0]?.count || 0,
			active: active[0]?.count || 0,
			admins: admins[0]?.count || 0
		});
	} catch (err) {
		res.status(500).json({ error: 'Failed to fetch user stats' });
	}
});

export default router;
