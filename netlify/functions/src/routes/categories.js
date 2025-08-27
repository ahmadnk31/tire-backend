"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const allCategories = await db_1.db.select().from(schema_1.categories);
        const categoriesWithCounts = await Promise.all(allCategories.map(async (category) => {
            const seasonTypeMap = {
                'Summer Tires': 'summer',
                'Winter Tires': 'winter',
                'All-Season Tires': 'all-season',
                'Performance Tires': 'performance',
                "Second Hand": "second hand"
            };
            const seasonType = seasonTypeMap[category.name];
            let productCount = 0;
            if (seasonType) {
                const countResult = await db_1.db
                    .select({ count: (0, drizzle_orm_1.count)() })
                    .from(schema_1.products)
                    .where((0, drizzle_orm_1.eq)(schema_1.products.seasonType, seasonType));
                productCount = countResult[0]?.count || 0;
            }
            return {
                ...category,
                productCount
            };
        }));
        res.json({ categories: categoriesWithCounts });
    }
    catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, slug, description, icon, image, isActive, sortOrder, parentId } = req.body;
        if (!name || !slug) {
            return res.status(400).json({ error: 'Name and slug are required' });
        }
        const existing = await db_1.db.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.slug, slug));
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Category slug already exists' });
        }
        const [newCategory] = await db_1.db.insert(schema_1.categories).values({
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
    }
    catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id)
            return res.status(400).json({ error: 'Invalid category ID' });
        const { name, slug, description, icon, image, isActive, sortOrder, parentId } = req.body;
        const existing = await db_1.db.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.id, id));
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        if (slug && slug !== existing[0].slug) {
            const dup = await db_1.db.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.slug, slug));
            if (dup.length > 0) {
                return res.status(400).json({ error: 'Category slug already exists' });
            }
        }
        const updated = await db_1.db.update(schema_1.categories)
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
            .where((0, drizzle_orm_1.eq)(schema_1.categories.id, id))
            .returning();
        res.json(updated[0]);
    }
    catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});
exports.default = router;
