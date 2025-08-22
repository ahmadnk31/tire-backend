// GET /api/products/:id/related - Find related products by brand, model, or size (strict), exclude itself

// ...existing code...


import express from 'express';
import { eq, and, like, gte, lte, desc, asc, or, count, SQL, inArray } from 'drizzle-orm';
import { db } from '../db';
import { products, productImages } from '../db/schema';
const { productCategories, categories } = require('../db/schema');
import Fuse from 'fuse.js';

// Import security middleware
import { requireAuth, requireAdmin } from '../middleware/auth';
import { 
  productValidation, 
  idParamValidation, 
  paginationValidation,
  searchValidation,
  advancedSearchValidation,
  handleValidationErrors 
} from '../middleware/validation';

const router = express.Router();

// GET /api/products/search - Dedicated search endpoint
// Search products by query
router.get('/search', searchValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  console.log('[DEBUG] /api/products/search route hit. Query:', req.query);
  try {
  const { q, brand } = req.query;
  console.log('[DEBUG] Search params:', { q, brand });
  const search = String(q || '').trim();
  const brandFilter = typeof brand === 'string' ? brand.trim() : '';
  console.log('[DEBUG] /api/products/search called with:', { search, brandFilter });

  // Debug: print all query params
  console.log('[DEBUG] Query params:', req.query);
  console.log('[DEBUG] Search term:', search);
  console.log('[DEBUG] Brand filter:', brandFilter);

    // Fetch all products with their images and categories
    const allProducts = await db
      .select({
        // Product fields
        id: products.id,
        name: products.name,
        brand: products.brand,
        model: products.model,
        size: products.size,
        price: products.price,
        comparePrice: products.comparePrice,
        stock: products.stock,
        lowStockThreshold: products.lowStockThreshold,
        status: products.status,
        featured: products.featured,
        sku: products.sku,
        description: products.description,
        features: products.features,
        specifications: products.specifications,
        tags: products.tags,
        // Tire-specific fields
        tireWidth: products.tireWidth,
        aspectRatio: products.aspectRatio,
        rimDiameter: products.rimDiameter,
        loadIndex: products.loadIndex,
        speedRating: products.speedRating,
        seasonType: products.seasonType,
        tireType: products.tireType,
        // SEO fields
        seoTitle: products.seoTitle,
        seoDescription: products.seoDescription,
        // Timestamps
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        // Image info
        imageUrl: productImages.imageUrl,
        imageAltText: productImages.altText,
        imageIsMain: productImages.isPrimary,
        // Category info
        categoryId: categories.id,
        categoryName: categories.name,
        categorySlug: categories.slug,
      })
      .from(products)
      .leftJoin(productImages, eq(products.id, productImages.productId))
      .leftJoin(productCategories, eq(products.id, productCategories.productId))
      .leftJoin(categories, eq(productCategories.categoryId, categories.id));

    // Group products and aggregate images/categories
    const productsMap = new Map();
    allProducts.forEach(row => {
      if (!productsMap.has(row.id)) {
        productsMap.set(row.id, {
          ...row,
          images: [],
          categories: []
        });
      }

      const product = productsMap.get(row.id);
      
      // Add image if exists and not already added
      if (row.imageUrl && !product.images.some((img: any) => img.imageUrl === row.imageUrl)) {
        product.images.push({
          imageUrl: row.imageUrl,
          altText: row.imageAltText,
          isPrimary: row.imageIsMain
        });
      }

      // Add category if exists and not already added
      if (row.categoryId && !product.categories.some((cat: any) => cat.id === row.categoryId)) {
        product.categories.push({
          id: row.categoryId,
          name: row.categoryName,
          slug: row.categorySlug
        });
      }
    });

    const productsWithRelations = Array.from(productsMap.values()).map(p => {
      // Remove the individual image/category fields and clean up
      const { imageUrl, imageAltText, imageIsMain, categoryId, categoryName, categorySlug, ...cleanProduct } = p;
      return cleanProduct;
    });

    // Defensive: ensure all fields used in search are strings and not null/undefined
    const safeProducts = productsWithRelations.map(p => ({
      ...p,
      brand: typeof p.brand === 'string' ? p.brand : (p.brand ? String(p.brand) : ''),
      name: typeof p.name === 'string' ? p.name : (p.name ? String(p.name) : ''),
      model: typeof p.model === 'string' ? p.model : (p.model ? String(p.model) : ''),
      sku: typeof p.sku === 'string' ? p.sku : (p.sku ? String(p.sku) : ''),
    }));
    console.log('[DEBUG] Total products in DB:', safeProducts.length);

    // Filter by brand if provided
    let filteredProducts: any[] = safeProducts;
    if (brandFilter && brandFilter !== 'all') {
      filteredProducts = filteredProducts.filter(p => typeof p.brand === 'string' && p.brand.toLowerCase() === brandFilter.toLowerCase());
      console.log('[API] Filtered by brand:', brandFilter, '| Results:', filteredProducts.length);
    }

    // Debug: print all products that match the search term in any field before Fuse.js
    if (search && search.length > 0) {
      const debugMatches = filteredProducts.filter(p =>
        [p.name, p.brand, p.model, p.sku].some(field =>
          typeof field === 'string' && field.toLowerCase().includes(search.toLowerCase())
        )
      );
      console.log('[DEBUG] Products matching search term before Fuse.js:', debugMatches.map(p => ({ id: p.id, name: p.name, brand: p.brand, model: p.model, sku: p.sku, status: p.status })));
    }

    // Apply Fuse.js fuzzy search to filtered set
    let results: any[] = filteredProducts;
    if (search && search.length > 0) { // Allow all non-empty queries
      if (search.length <= 1) {
        // For very short queries, use simple substring matching
        results = filteredProducts.filter(p =>
          [p.name, p.brand, p.model, p.sku].some(field =>
            typeof field === 'string' && field.toLowerCase().includes(search.toLowerCase())
          )
        );
        console.log('[API] Short query substring match results:', results.length);
      } else {
        // Use Fuse.js for longer queries
        const fuse = new Fuse(filteredProducts, {
          keys: ['name', 'brand', 'model', 'sku'],
          threshold: 0.4, // More lenient matching
          minMatchCharLength: 1,
          ignoreLocation: true,
          includeScore: true,
        });
        const fuseRaw = fuse.search(search.toLowerCase());
        results = fuseRaw.map((r: any) => r.item);
        // Fallback: if Fuse.js returns no results, do a substring match
        if (results.length === 0) {
          results = filteredProducts.filter(p =>
            [p.name, p.brand, p.model, p.sku].some(field =>
              typeof field === 'string' && field.toLowerCase().includes(search.toLowerCase())
            )
          );
          console.log('[API] Fallback substring match results:', results.length);
        }
        console.log('[API] Fuse.js search string:', search, '| Results:', results.length, '| Top match:', fuseRaw[0]?.item?.name, '| Score:', fuseRaw[0]?.score);
      }
    } else if (search && search.length <= 2) {
      results = [];
      console.log('[API] Query too short (<=2), returning empty array.');
    }

    // Fetch images for all matching products in one query
    const productIds = results.map(p => p.id);
    let imagesByProductId: Record<number, any[]> = {};
    if (productIds.length > 0) {
      const images = await db.select().from(productImages).where(inArray(productImages.productId, productIds));
      imagesByProductId = images
        .filter(img => img.productId !== null)
        .reduce((acc, img) => {
          if (!acc[img.productId!]) acc[img.productId!] = [];
          acc[img.productId!].push(img);
          return acc;
        }, {} as Record<number, any[]>);
    }
    // Attach images to each product
    const resultsWithImages = results.map(p => ({
      ...p,
      images: imagesByProductId[p.id] || []
    }));
    res.json({ products: resultsWithImages });
  } catch (error) {
    const stack = (error instanceof Error && error.stack) ? error.stack : '';
    console.error('Error in /api/products/search:', error, '| Query:', req.query, '| Stack:', stack);
    res.status(500).json({ error: 'Failed to search products' });
  }
});




// GET /api/products - Get all products with filtering and pagination
// Get all products with optional filtering, sorting, and search
router.get('/', advancedSearchValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      brand, 
      model,
      size,
      status, 
      featured, 
      minPrice, 
      maxPrice, 
      search,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    console.log('[API] /api/products called', { page, limit, brand, status, featured, minPrice, maxPrice, search, category, sortBy, sortOrder });
    // Debug: print received category param
    if (category) {
      console.log('[DEBUG] Received category param:', category);
    }

    // Build where conditions for all supported filters
    const whereConditions: SQL[] = [];
    if (brand && brand !== 'all') {
      whereConditions.push(eq(products.brand, brand as string));
    }
    if (model && model !== 'all') {
      whereConditions.push(eq(products.model, model as string));
    }
    if (size && size !== 'all') {
      whereConditions.push(eq(products.size, size as string));
    }
    if (status && status !== 'all') {
      whereConditions.push(eq(products.status, status as string));
    }
    if (featured === 'true') {
      whereConditions.push(eq(products.featured, true));
    }
    if (minPrice) {
      whereConditions.push(gte(products.price, minPrice as string));
    }
    if (maxPrice) {
      whereConditions.push(lte(products.price, maxPrice as string));
    }

    // Category filtering - need to join with productCategories and categories
    let categoryFilterIds: number[] = [];
    if (category && category !== 'all') {
      console.log('[DEBUG] Filtering by category:', category);
      
      // First, find the category ID(s) that match the category name or slug
      const categoryResults = await db
        .select({ id: categories.id })
        .from(categories)
        .where(or(
          eq(categories.name, category as string),
          eq(categories.slug, category as string)
        ));
      
      categoryFilterIds = categoryResults.map(c => c.id);
      console.log('[DEBUG] Found category IDs:', categoryFilterIds);
      
      if (categoryFilterIds.length > 0) {
        // Get product IDs that belong to these categories
        const productCategoryResults = await db
          .select({ productId: productCategories.productId })
          .from(productCategories)
          .where(inArray(productCategories.categoryId, categoryFilterIds));
        
        const filteredProductIds = productCategoryResults.map(pc => pc.productId);
        console.log('[DEBUG] Products in category:', filteredProductIds);
        
        if (filteredProductIds.length > 0) {
          whereConditions.push(inArray(products.id, filteredProductIds));
        } else {
          // No products found in this category, return empty result
          whereConditions.push(eq(products.id, -1)); // This will always be false
        }
      } else {
        console.log('[DEBUG] Category not found:', category);
        // Category not found, return empty result
        whereConditions.push(eq(products.id, -1)); // This will always be false
      }
    }


    // Combine where conditions
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // If search is present, use Fuse.js for fuzzy search after filtering by other conditions
    let fuseResults: any[] | null = null;
    let filteredProducts: any[] | null = null;
    if (search) {
      console.log('[API] Using Fuse.js for fuzzy search:', search);
      // First, filter products by whereClause
      filteredProducts = await db.select().from(products).where(whereClause);
      console.log('[API] Total products after filters for Fuse.js:', filteredProducts.length);
      const searchStr = String(search).toLowerCase();
      let fuseRaw = [];
      if (searchStr.length <= 2) {
        // For 1-2 letter queries, show all filtered products
        fuseResults = filteredProducts;
        console.log('[API] Short query, returning all filtered products:', fuseResults.length);
      } else {
        const fuse = new Fuse(filteredProducts, {
          keys: ['name', 'brand', 'model', 'sku'],
          threshold: 0.3, // stricter matching
          minMatchCharLength: 1,
          ignoreLocation: true,
          includeScore: true,
        });
        fuseRaw = fuse.search(searchStr);
        fuseResults = fuseRaw.map((r: any) => r.item);
        // Fallback: if Fuse.js returns no results, do a substring match
        if (fuseResults && fuseResults.length === 0) {
          fuseResults = filteredProducts.filter(p =>
            [p.name, p.brand, p.model, p.sku].some(field =>
              typeof field === 'string' && field.toLowerCase().includes(searchStr)
            )
          );
          console.log('[API] Fallback substring match results:', fuseResults.length);
        }
        console.log('[API] Fuse.js search string:', search, '| Results:', fuseResults?.length, '| Top match:', fuseRaw[0]?.item?.name, '| Score:', fuseRaw[0]?.score);
      }
    }

    // Get total count
    let totalProducts;
    if (fuseResults && fuseResults.length > 0) {
      totalProducts = fuseResults.length;
    } else {
      const totalCountResult = await db
        .select({ count: count() })
        .from(products)
        .where(whereClause);
      totalProducts = totalCountResult[0]?.count || 0;
    }

    // Apply sorting
    const sortOptions: Record<string, any> = {
      'name': products.name,
      'price': products.price,
      'brand': products.brand,
      'createdAt': products.createdAt,
      'stock': products.stock,
      'rating': products.rating
    };

    const sortColumn = sortOptions[sortBy as string] || products.createdAt;
    const orderBy = sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);

    // Apply pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;


    let result;
    if (fuseResults) {
      // Paginate fuzzy results
      result = fuseResults.slice(offset, offset + limitNum);
      console.log('[API] Returning paginated Fuse.js results:', result.length);
    } else {
      // Execute query as before
      result = await db
        .select()
        .from(products)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);
      console.log('[API] Returning DB query results:', result.length);
    }

    // Get filter options
    const brandsResult = await db.selectDistinct({ brand: products.brand }).from(products);
    const statusesResult = await db.selectDistinct({ status: products.status }).from(products);
    
    const priceResult = await db.select({
      price: products.price
    }).from(products);

    const prices = priceResult.map(p => parseFloat(p.price || '0')).filter(p => p > 0);
    const minPriceResult = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPriceResult = prices.length > 0 ? Math.max(...prices) : 0;

    // Attach categoryIds to each product
    const productIds = result.map(p => p.id);
    let prodCatRows: { productId: number, categoryId: number }[] = [];
    if (productIds.length > 0) {
      const rawRows = await db.select().from(productCategories).where(inArray(productCategories.productId, productIds));
      prodCatRows = rawRows.map((row: any) => ({ productId: row.productId, categoryId: row.categoryId }));
    }
    const categoryIdsByProductId: Record<number, number[]> = {};
    prodCatRows.forEach(pc => {
      if (!categoryIdsByProductId[pc.productId]) categoryIdsByProductId[pc.productId] = [];
      categoryIdsByProductId[pc.productId].push(pc.categoryId);
    });
    const resultWithCategories = result.map(p => ({
      ...p,
      categoryIds: categoryIdsByProductId[p.id] || [],
      seoTitle: p.seoTitle || '',
      seoDescription: p.seoDescription || ''
    }));

    // Fetch images for all products
    let imagesByProductId: Record<number, any[]> = {};
    if (productIds.length > 0) {
      const images = await db.select().from(productImages).where(inArray(productImages.productId, productIds));
      imagesByProductId = images
        .filter(img => img.productId !== null)
        .reduce((acc, img) => {
          if (!acc[img.productId!]) acc[img.productId!] = [];
          acc[img.productId!].push(img);
          return acc;
        }, {} as Record<number, any[]>);
    }

    // Attach images to each product
    const resultWithCategoriesAndImages = resultWithCategories.map(p => ({
      ...p,
      productImages: imagesByProductId[p.id] || []
    }));

    // Debug: print filtered products and their categoryIds
    console.log('[DEBUG] Filtered products:', resultWithCategoriesAndImages.map(p => ({ id: p.id, name: p.name, categoryIds: p.categoryIds })));
    res.json({
      products: resultWithCategoriesAndImages,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalProducts / limitNum),
        totalProducts,
        productsPerPage: limitNum
      },
      filters: {
        brands: brandsResult.map(b => b.brand),
        statuses: statusesResult.map(s => s.status),
        priceRange: {
          min: minPriceResult,
          max: maxPriceResult
        }
      }
    });
    console.log('[API] Response sent for /api/products');
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Get single product
// Get a single product by ID
router.get('/:id', idParamValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const productId = Number(req.params.id);
    if (!req.params.id || isNaN(productId) || !Number.isFinite(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await db.select().from(products).where(eq(products.id, productId));

    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get product images
        const images = await db.select().from(productImages)
          .where(eq(productImages.productId, productId))
          .orderBy(asc(productImages.sortOrder));

        // Get categories for this product
        const prodCatRows = await db.select().from(productCategories).where(eq(productCategories.productId, productId));
        const categoryIds = prodCatRows.map((pc: any) => pc.categoryId);
  let categoriesForProduct: any[] = [];
        if (categoryIds.length > 0) {
          categoriesForProduct = await db.select().from(categories).where(inArray(categories.id, categoryIds));
        }

        const product = {
          ...result[0],
          productImages: images,
          categories: categoriesForProduct,
          seoTitle: result[0].seoTitle || '',
          seoDescription: result[0].seoDescription || ''
        };
        res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});



// POST /api/products - Create new product
// Create a new product (admin only)
router.post('/', requireAuth, requireAdmin, productValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const {
      name,
      brand,
      model,
      size,
      price,
      comparePrice,
      stock,
      lowStockThreshold,
      status = 'draft',
      featured = false,
      sku,
      description,
      features,
      specifications,
      tags,
      // New tire-specific fields
      tireWidth,
      aspectRatio,
      rimDiameter,
      loadIndex,
      speedRating,
      seasonType,
      tireType,
      // SEO fields
      seoTitle,
      seoDescription,
      // Images and categories
      productImages: newImages = [],
      categoryIds = []
    } = req.body;

    // Generate SKU if not provided
    const finalSku = sku || `${brand.substring(0, 3).toUpperCase()}-${model.substring(0, 3).toUpperCase()}-${size.replace(/[\/]/g, '-')}`;

    // Auto-generate size from tire dimensions if provided
    let finalSize = size;
    if (tireWidth && aspectRatio && rimDiameter) {
      finalSize = `${tireWidth}/${aspectRatio}R${rimDiameter}`;
    }

    const newProduct = await db.insert(products).values({
      name,
      brand,
      model,
      size: finalSize,
      price: price.toString(),
      comparePrice: comparePrice ? comparePrice.toString() : null,
      stock,
      lowStockThreshold: lowStockThreshold || 10,
      status,
      featured,
      sku: finalSku,
      description,
      features,
      specifications,
      tags,
      // Tire-specific fields
      tireWidth: tireWidth || null,
      aspectRatio: aspectRatio || null,
      rimDiameter: rimDiameter || null,
      loadIndex: loadIndex || null,
      speedRating: speedRating || null,
      seasonType: seasonType || null,
      tireType: tireType || null,
      // SEO fields
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      updatedAt: new Date(),
    }).returning();

    // Insert product images if provided
    if (newImages.length > 0) {
      const imageInserts = newImages.map((img: any, index: number) => ({
        productId: newProduct[0].id,
        imageUrl: img.url || img.imageUrl, // Support both field names
        altText: img.altText || `${name} - Image ${index + 1}`,
        isPrimary: index === 0,
        sortOrder: index,
      }));

      await db.insert(productImages).values(imageInserts);
    }

    // Insert product categories if provided
    if (categoryIds && categoryIds.length > 0) {
      await db.insert(productCategories).values(
        categoryIds.map((categoryId: string) => ({
          productId: newProduct[0].id,
          categoryId
        }))
      );
    }

    res.status(201).json(newProduct[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error instanceof Error && error.message.includes('unique')) {
      res.status(400).json({ error: 'SKU already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
});

// PUT /api/products/:id - Update product
// Update a product (admin only)
router.put('/:id', requireAuth, requireAdmin, idParamValidation, productValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const productId = parseInt(req.params.id);
    const {
      productImages: newImages,
      categoryIds,
      tireWidth,
      aspectRatio,
      rimDiameter,
      size: providedSize,
      price,
      comparePrice,
      ...otherData
    } = req.body;
    
    // Auto-generate size from tire dimensions if provided
    let finalSize = providedSize;
    if (tireWidth && aspectRatio && rimDiameter) {
      finalSize = `${tireWidth}/${aspectRatio}R${rimDiameter}`;
    }

    const updateData = {
      ...otherData,
      size: finalSize,
      price: price ? price.toString() : undefined,
      comparePrice: comparePrice ? comparePrice.toString() : null,
      // Tire-specific fields
      tireWidth: tireWidth || null,
      aspectRatio: aspectRatio || null,
      rimDiameter: rimDiameter || null,
      updatedAt: new Date()
    };

    const result = await db.update(products)
      .set(updateData)
      .where(eq(products.id, productId))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update product images if provided
    if (newImages && Array.isArray(newImages)) {
      // Delete existing images
      await db.delete(productImages).where(eq(productImages.productId, productId));
      
      // Insert new images
      if (newImages.length > 0) {
        const imageInserts = newImages.map((img: any, index: number) => ({
          productId: productId,
          imageUrl: img.url || img.imageUrl, // Support both field names
          altText: img.altText || `${result[0].name} - Image ${index + 1}`,
          isPrimary: index === 0,
          sortOrder: index,
        }));

        await db.insert(productImages).values(imageInserts);
      }
    }

    // Update product categories if provided
    if (categoryIds && Array.isArray(categoryIds)) {
      // Delete existing product-category relationships
      await db.delete(productCategories).where(eq(productCategories.productId, productId));
      
      // Insert new product-category relationships
      if (categoryIds.length > 0) {
        await db.insert(productCategories).values(
          categoryIds.map((categoryId: string) => ({
            productId,
            categoryId
          }))
        );
      }
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete product
// Delete a product (admin only)
router.delete('/:id', requireAuth, requireAdmin, idParamValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const productId = parseInt(req.params.id);
    
    const result = await db.delete(products)
      .where(eq(products.id, productId))
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

// GET /api/products/featured/list - Get featured products
// Get featured products
router.get('/featured/list', paginationValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const result = await db.select()
      .from(products)
      .where(and(eq(products.featured, true), eq(products.status, 'published')));
    res.json({ products: result });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});
// Get related products for a specific product
router.get('/:id/related', idParamValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { eq, and, ne, or } = require('drizzle-orm');
    const productId = Number(req.params.id);
    if (!req.params.id || isNaN(productId) || !Number.isFinite(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    const result = await db.select().from(products).where(eq(products.id, productId));
    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const mainProduct = result[0];
    // Build strict related query: match brand, model, or size, exclude itself
    const whereRelated: any[] = [];
    if (mainProduct.brand) {
      whereRelated.push(and(eq(products.brand, mainProduct.brand), ne(products.id, productId)));
    }
    if (mainProduct.model) {
      whereRelated.push(and(eq(products.model, mainProduct.model), ne(products.id, productId)));
    }
    if (mainProduct.size) {
      whereRelated.push(and(eq(products.size, mainProduct.size), ne(products.id, productId)));
    }
    let relatedProducts: any[] = [];
    if (whereRelated.length > 0) {
      relatedProducts = await db.select().from(products).where(or(...whereRelated)).limit(12);
    }
    // Attach images
    const productIds: number[] = relatedProducts.map(p => p.id);
    let imagesByProductId: Record<number, any[]> = {};
    if (productIds.length > 0) {
      const images = await db.select().from(productImages).where(inArray(productImages.productId, productIds));
      imagesByProductId = images
        .filter(img => img.productId !== null && img.productId !== undefined)
        .reduce((acc: Record<number, any[]>, img: any) => {
          if (img.productId !== null && img.productId !== undefined) {
            if (!acc[img.productId]) acc[img.productId] = [];
            acc[img.productId].push(img);
          }
          return acc;
        }, {});
    }
    const relatedWithImages = relatedProducts.map((p: any) => ({
      ...p,
      images: imagesByProductId[p.id] || []
    }));
    res.json({ products: relatedWithImages });
  } catch (error) {
    console.error('Error fetching related products:', error);
    res.status(500).json({ error: 'Failed to fetch related products' });
  }
});


export default router;
