import { Router } from 'express';
import { db } from '../db';
import { wishlist, products } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();


// Get wishlist for current user
router.get('/', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const items = await db.query.wishlist.findMany({ where: eq(wishlist.userId, userId) });
  res.json({ wishlist: items });
});

// Add product to wishlist
router.post('/', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const { productId } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!productId) return res.status(400).json({ error: 'Missing productId' });
  // Prevent duplicate wishlist entries
  const existing = await db.query.wishlist.findFirst({
    where: (row) => eq(row.userId, userId) && eq(row.productId, productId)
  });
  if (existing) {
    return res.status(200).json({ message: 'Already in wishlist' });
  }
  const inserted = await db.insert(wishlist).values({ userId, productId }).returning();
  res.status(201).json(inserted[0]);
});

// Remove product from wishlist
router.delete('/:productId', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const productId = parseInt(req.params.productId);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!productId) return res.status(400).json({ error: 'Missing productId' });
  const { and, eq } = require('drizzle-orm');
  const deleted = await db.delete(wishlist)
    .where(and(eq(wishlist.userId, userId), eq(wishlist.productId, productId)))
    .returning();
  if (deleted.length === 0) {
    return res.status(404).json({ error: 'Wishlist item not found' });
  }
  res.status(204).send();
});

export default router;
