import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Get current user account info
router.get('/', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});


// Update profile (name, email)
router.put('/', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const { name, email } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!name && !email) return res.status(400).json({ error: 'Nothing to update' });
  try {
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    await db.update(users).set(updateData).where(eq(users.id, userId));
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update profile', details: err?.message || err });
  }
});

// Change password
router.post('/change-password', requireAuth, async (req, res) => {
  const userId = (req as any).user?.id;
  const { currentPassword, newPassword } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const bcrypt = require('bcryptjs');
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
  const hashed = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ password: hashed }).where(eq(users.id, userId));
  res.json({ success: true });
});

export default router;
