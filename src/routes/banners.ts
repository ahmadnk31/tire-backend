
import { Router } from "express";
import { db } from "../db/index";
import { banners } from "../db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

// Get all banners
router.get("/", async (req, res) => {
  try {
    const all = await db.select().from(banners).where(eq(banners.isActive, true)).orderBy(asc(banners.sortOrder));
    res.json({ banners: all });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch banners" });
  }
});

// Create a new banner
router.post("/", async (req, res) => {
  try {
    const { type, src, headline, subheadline, description, sortOrder, isActive } = req.body;
    const [created] = await db.insert(banners).values({
      type,
      src,
      headline,
      subheadline,
      description,
      sortOrder,
      isActive,
    }).returning();
    res.status(201).json({ banner: created });
  } catch (err) {
    res.status(500).json({ error: "Failed to create banner" });
  }
});

// Update a banner
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, src, headline, subheadline, description, sortOrder, isActive } = req.body;
    const [updated] = await db.update(banners)
      .set({ type, src, headline, subheadline, description, sortOrder, isActive })
      .where(eq(banners.id, Number(id)))
      .returning();
    res.json({ banner: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update banner" });
  }
});

// Delete a banner
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(banners).where(eq(banners.id, Number(id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete banner" });
  }
});

export default router;
