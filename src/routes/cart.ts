import { Router } from 'express';
import { db } from '../db';
import { cartItems, products } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Get cart items for logged-in user
router.get('/', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const items = await db.query.cartItems.findMany({ where: eq(cartItems.userId, userId) });
  res.json({ cart: items });
});

// Add or update cart item (upsert)
router.post('/', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const { productId, quantity, size } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!productId || !quantity) return res.status(400).json({ error: 'Missing productId or quantity' });
  // Check if item exists
  const existing = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)),
  });
  if (existing) {
    // Update quantity
    const updated = await db.update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existing.id))
      .returning();
    return res.json(updated[0]);
  } else {
    // Insert new
  // Provide a dummy sessionId for logged-in users
  const inserted = await db.insert(cartItems).values({ sessionId: 'user', userId, productId, quantity, createdAt: new Date(), updatedAt: new Date() }).returning();
  return res.status(201).json(inserted[0]);
  }
});

// Remove cart item
router.delete('/:id', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const id = parseInt(req.params.id);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!id) return res.status(400).json({ error: 'Missing cart item id' });
  const deleted = await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.userId, userId))).returning();
  if (deleted.length === 0) {
    return res.status(404).json({ error: 'Cart item not found' });
  }
  res.status(204).send();
});

// Clear cart
router.delete('/', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
  res.status(204).send();
});

export default router;
