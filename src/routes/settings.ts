import { Router } from 'express';
import { db } from '../db';
import { users, userAddresses } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Update user settings (example: name)
router.put('/', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const { name } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  await db.update(users).set({ name }).where(eq(users.id, userId));
  res.json({ success: true });
});


// Get all addresses for current user
router.get('/addresses', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const addresses = await db.query.userAddresses.findMany({ where: eq(userAddresses.userId, userId) });
  res.json({ addresses });
});

// Add new address
router.post('/addresses', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const { type, street, city, state, zipCode, country } = req.body;
  if (!userId || !type || !street || !city || !state || !zipCode || !country) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const [address] = await db.insert(userAddresses).values({ userId, type, street, city, state, zipCode, country }).returning();
  res.json({ address });
});

// Update address
router.put('/addresses/:id', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const { id } = req.params;
  const { type, street, city, state, zipCode, country } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const address = await db.query.userAddresses.findFirst({ where: eq(userAddresses.id, Number(id)) });
  if (!address || address.userId !== userId) return res.status(404).json({ error: 'Address not found' });
  await db.update(userAddresses).set({ type, street, city, state, zipCode, country }).where(eq(userAddresses.id, Number(id)));
  const updated = await db.query.userAddresses.findFirst({ where: eq(userAddresses.id, Number(id)) });
  res.json({ address: updated });
});

// Delete address
router.delete('/addresses/:id', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const address = await db.query.userAddresses.findFirst({ where: eq(userAddresses.id, Number(id)) });
  if (!address || address.userId !== userId) return res.status(404).json({ error: 'Address not found' });
  await db.delete(userAddresses).where(eq(userAddresses.id, Number(id)));
  res.json({ success: true });
});

// Get default address for current user
router.get('/addresses/default', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  let type = req.query.type || 'shipping';
  if (Array.isArray(type)) type = type[0];
  if (typeof type !== 'string') type = 'shipping';
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  // Find default address
  const address = await db.query.userAddresses.findFirst({
    where: and(
      eq(userAddresses.userId, userId),
      eq(userAddresses.type, type),
      eq(userAddresses.isDefault, true)
    )
  });
  // If no default, fallback to any shipping address
  if (!address) {
    const anyAddress = await db.query.userAddresses.findFirst({
      where: and(
        eq(userAddresses.userId, userId),
        eq(userAddresses.type, type)
      )
    });
    return res.json({ address: anyAddress || null });
  }
  res.json({ address });
});

export default router;
