import express from 'express';
import { db } from '../db';
import { categories, productCategories, products } from '../db/schema';
import { eq, count } from 'drizzle-orm';

const router = express.Router();

// GET /api/categories - List all categories with product counts
router.get('/', async (req, res) => {
  try {
    const allCategories = await db.select().from(categories);
    
    // Get product counts for each category based on seasonType
    const categoriesWithCounts = await Promise.all(
      allCategories.map(async (category) => {
        // Map category names to seasonType values
        const seasonTypeMap: { [key: string]: string } = {
          'Summer Tires': 'summer',
          'Winter Tires': 'winter',
          'All-Season Tires': 'all-season',
          'Performance Tires': 'performance',
          'Commercial Tires': 'commercial'
        };
        
        const seasonType = seasonTypeMap[category.name];
        let productCount = 0;
        
        if (seasonType) {
          const countResult = await db
            .select({ count: count() })
            .from(products)
            .where(eq(products.seasonType, seasonType));
          
          productCount = countResult[0]?.count || 0;
        }
        
        return {
          ...category,
          productCount
        };
      })
    );
    
    res.json({ categories: categoriesWithCounts });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories - Create a new category
router.post('/', async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      icon,
      image,
      isActive,
      sortOrder,
      parentId
    } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }
    // Check for duplicate slug
    const existing = await db.select().from(categories).where(eq(categories.slug, slug));
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Category slug already exists' });
    }
    const [newCategory] = await db.insert(categories).values({
      name,
      slug,
      description,
      icon,
      image,
      isActive,
      sortOrder,
      parentId
    }).returning();
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id - Update a category
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid category ID' });
    const {
      name,
      slug,
      description,
      icon,
      image,
      isActive,
      sortOrder,
      parentId
    } = req.body;
    // Check if category exists
    const existing = await db.select().from(categories).where(eq(categories.id, id));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    // Check for duplicate slug (if changed)
    if (slug && slug !== existing[0].slug) {
      const dup = await db.select().from(categories).where(eq(categories.slug, slug));
      if (dup.length > 0) {
        return res.status(400).json({ error: 'Category slug already exists' });
      }
    }
    const updated = await db.update(categories)
      .set({
        name,
        slug,
        description,
        icon,
        image,
        isActive,
        sortOrder,
        parentId
      })
      .where(eq(categories.id, id))
      .returning();
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

export default router;
