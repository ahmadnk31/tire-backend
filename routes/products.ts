import express, { Request, Response } from 'express';
import { eq, and, gte, lte, like, or, desc, asc } from 'drizzle-orm';
import { db } from '../src/db';
import { products, productImages } from '../src/db/schema';

const router = express.Router();

interface ProductFilters {
  page?: string;
  limit?: string;
  brand?: string;
  model?: string;
  status?: string;
  featured?: string;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// GET /api/products - Get all products with filtering and pagination
router.get('/', async (req: Request<{}, {}, {}, ProductFilters>, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      brand, 
      model,
      status, 
      featured, 
      minPrice, 
      maxPrice, 
      search,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build conditions array
    const conditions: any[] = [];
    const { sql } = require('drizzle-orm');

    if (brand && brand !== 'all') {
      conditions.push(sql`${products.brand} ILIKE ${`%${brand}%`}`);
    }

    if (model && model !== 'all') {
      conditions.push(sql`LOWER(${products.model}) LIKE LOWER(${`%${model}%`})`);
    }

    if (status && status !== 'all') {
      conditions.push(eq(products.status, status));
    }

    if (featured === 'true') {
      conditions.push(eq(products.featured, true));
    }

    if (minPrice) {
      conditions.push(gte(products.price, minPrice));
    }

    if (maxPrice) {
      conditions.push(lte(products.price, maxPrice));
    }

    // Category filter (by slug or name)
    if (req.query.category && req.query.category !== 'all') {
      const cat = req.query.category;
      conditions.push(sql`EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON pc.category_id = c.id WHERE pc.product_id = ${products.id} AND (c.slug = ${cat} OR c.name ILIKE ${cat}))`);
    }

    // Search term (search in name, brand, model, size, tags)
    if (req.query.search && req.query.search.length > 1) {
      const term = req.query.search;
      conditions.push(sql`(
        ${products.name} ILIKE ${`%${term}%`} OR
        ${products.brand} ILIKE ${`%${term}%`} OR
        ${products.model} ILIKE ${`%${term}%`} OR
        ${products.size} ILIKE ${`%${term}%`} OR
        ${products.tags}::text ILIKE ${`%${term}%`}
      )`);
    }

    // Build where clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order clause - fix the field access
    let orderClause;
    if (sortBy === 'name') {
      orderClause = sortOrder === 'desc' ? desc(products.name) : asc(products.name);
    } else if (sortBy === 'price') {
      orderClause = sortOrder === 'desc' ? desc(products.price) : asc(products.price);
    } else if (sortBy === 'brand') {
      orderClause = sortOrder === 'desc' ? desc(products.brand) : asc(products.brand);
    } else {
      orderClause = sortOrder === 'desc' ? desc(products.name) : asc(products.name);
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const result = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limitNum)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: products.id })
      .from(products)
      .where(whereClause);
    
    const totalCount = totalResult.length;

    // Get filter options
    const allProducts = await db.select().from(products);
    const brands = [...new Set(allProducts.map(p => p.brand))];
    const statuses = [...new Set(allProducts.map(p => p.status))];
    const prices = allProducts.map(p => p.price);

    res.json({
      products: result,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalProducts: totalCount,
        productsPerPage: limitNum
      },
      filters: {
        brands,
        statuses,
        priceRange: {
          min: Math.min(...prices.map(p => parseFloat(p))),
          max: Math.max(...prices.map(p => parseFloat(p)))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    const result = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products - Create new product
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, createdAt, updatedAt, ...requestData } = req.body;
    
    const productData = {
      ...requestData,
      // Don't include id - it's auto-generated
      // Don't include timestamps - they use database defaults
    };

    // Generate SKU if not provided
    if (!productData.sku) {
      const brand = productData.brand?.substring(0, 3).toUpperCase() || 'PRD';
      const model = productData.model?.substring(0, 3).toUpperCase() || 'MDL';
      const size = productData.size?.replace(/[\/]/g, '-') || 'SIZE';
      productData.sku = `${brand}-${model}-${size}-${Date.now()}`;
    }

    // Ensure required fields have proper defaults
    if (!productData.name) {
      productData.name = `${productData.brand} ${productData.model} ${productData.size}`;
    }

    const result = await db.insert(products).values(productData).returning();
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id, createdAt, ...requestData } = req.body;
    
    const updateData = {
      ...requestData,
      // Don't update createdAt, only updatedAt will be handled by database
    };

    const result = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, parseInt(req.params.id)))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db
      .delete(products)
      .where(eq(products.id, parseInt(req.params.id)))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET /api/products/featured - Get featured products
router.get('/featured/list', async (req: Request, res: Response) => {
  try {
    const result = await db
      .select()
      .from(products)
      .where(and(eq(products.featured, true), eq(products.status, 'published')));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

export default router;
