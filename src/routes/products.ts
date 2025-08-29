// GET /api/products/:id/related - Find related products by brand, model, or size (strict), exclude itself

// ...existing code...


import express from 'express';
import { eq, and, like, ilike, gte, lte, desc, asc, or, count, SQL, inArray, ne } from 'drizzle-orm';
import { db } from '../db';
import { products, productImages, productCategories, categories } from '../db/schema';
import Fuse from 'fuse.js';
import { generateProductSlug } from '../utils/slugGenerator';

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
  
  // Decode the search query to handle URL encoding
  let search = String(q || '').trim();
  if (search.includes('&#x2F;') || search.includes('&#x2f;') || search.includes('&#47;')) {
    const originalSearch = search;
    search = search
      .replace(/&#x2F;/g, '/')
      .replace(/&#x2f;/g, '/')
      .replace(/&#47;/g, '/')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
    console.log('[DEBUG] Decoded search query:', { original: originalSearch, decoded: search });
  }
  
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
        slug: products.slug,
        description: products.description,
        features: products.features,
        specifications: products.specifications,
        tags: products.tags,
        // Tire-specific fields
        
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

    // Apply Fuse.js fuzzy search to filtered set with comprehensive search
    let results: any[] = filteredProducts;
    if (search && search.length > 0) {
      console.log('[API] Performing comprehensive Fuse.js search for:', search);
      console.log('[DEBUG] Search query details:', {
        original: search,
        length: search.length,
        containsHtmlEntities: search.includes('&#'),
        containsForwardSlash: search.includes('/'),
        containsAmpersand: search.includes('&')
      });
      
      // Create Fuse.js instance with comprehensive search keys
      const fuse = new Fuse(filteredProducts, {
        keys: [
          'name',
          'brand', 
          'model',
          'size',
          'sku',
          'description',
          'seasonType',
          'tireType',
          'loadIndex',
          'speedRating',
          'tags',
          'features',
          'specifications',
          'categoryName',
          'categorySlug'
        ],
        threshold: 0.4, // Balanced threshold for good matches
        minMatchCharLength: 2,
        ignoreLocation: true,
        includeScore: true,
        includeMatches: true,
        shouldSort: true,
        // Custom getFn to handle JSON fields and filter out CSS/HTML content
        getFn: (obj, path) => {
          const value = Fuse.config.getFn(obj, path);
          
          // Handle JSON fields (tags, features, specifications)
          if (typeof value === 'string' && (path === 'tags' || path === 'features' || path === 'specifications')) {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                return parsed.join(' ');
              }
              return JSON.stringify(parsed);
            } catch {
              return value;
            }
          }
          
                      // Filter out CSS classes and HTML content from string values
            if (typeof value === 'string') {
              // Decode HTML entities first
              let cleanValue = value
                .replace(/&#x2F;/g, '/') // Convert &#x2F; to /
                .replace(/&#x2f;/g, '/') // Convert &#x2f; to / (lowercase)
                .replace(/&#47;/g, '/') // Convert &#47; to /
                .replace(/&amp;/g, '&') // Convert &amp; to &
                .replace(/&lt;/g, '<') // Convert &lt; to <
                .replace(/&gt;/g, '>') // Convert &gt; to >
                .replace(/&quot;/g, '"') // Convert &quot; to "
                .replace(/&#39;/g, "'") // Convert &#39; to '
                .replace(/&apos;/g, "'"); // Convert &apos; to '
              
              // Remove CSS classes (words starting with . or containing common CSS patterns)
              cleanValue = cleanValue
                .replace(/\.[a-zA-Z0-9_-]+/g, '') // Remove CSS classes like .bg-red-500
                .replace(/[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '') // Remove more CSS patterns
                .replace(/class\s*=\s*["'][^"']*["']/g, '') // Remove class attributes
                .replace(/className\s*=\s*["'][^"']*["']/g, '') // Remove className attributes
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
              
              // Only return if the cleaned value has meaningful content
              if (cleanValue.length > 2) {
                return cleanValue;
              }
            }
          
          return value;
        }
      });
      
      const fuseResults = fuse.search(search);
      console.log('[API] Fuse.js raw results:', fuseResults.length);
      
      // Debug: Log the first few results to see what's being matched
      if (fuseResults.length > 0) {
        console.log('[DEBUG] First 3 search results:');
        fuseResults.slice(0, 3).forEach((result, index) => {
          console.log(`  ${index + 1}. Score: ${result.score}, Item:`, {
            id: result.item.id,
            name: result.item.name,
            brand: result.item.brand,
            size: result.item.size,
            matches: result.matches?.map(m => ({ key: m.key, value: m.value, indices: m.indices }))
          });
        });
      }
      
      // Map results and include search metadata
      results = fuseResults.map(result => ({
        ...result.item,
        searchScore: result.score,
        searchMatches: result.matches
      }));
      
      // Fallback: if Fuse.js returns no results, do a simple substring match
      if (results.length === 0) {
        console.log('[API] No Fuse.js results, trying fallback substring search');
        results = filteredProducts.filter(p =>
          [p.name, p.brand, p.model, p.sku, p.size, p.description].some(field =>
            typeof field === 'string' && field.toLowerCase().includes(search.toLowerCase())
          )
        );
        console.log('[API] Fallback substring match results:', results.length);
      }
      
      console.log('[API] Final search results:', {
        query: search,
        totalResults: results.length,
        topResult: results[0]?.name,
        topScore: results[0]?.searchScore
      });
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
      seasonType,
      speedRating,
      loadIndex,
      tireType,
      construction,
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
    
    // Handle multiple brand values
    if (brand && brand !== 'all') {
      const brands = Array.isArray(brand) ? brand : [brand];
      if (brands.length > 0) {
        whereConditions.push(inArray(products.brand, brands as string[]));
      }
    }
    
    // Handle multiple model values
    if (model && model !== 'all') {
      const models = Array.isArray(model) ? model : [model];
      if (models.length > 0) {
        whereConditions.push(inArray(products.model, models as string[]));
      }
    }
    
    // Handle multiple size values
    if (size && size !== 'all') {
      const sizes = Array.isArray(size) ? size : [size];
      if (sizes.length > 0) {
        whereConditions.push(inArray(products.size, sizes as string[]));
      }
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

    // Handle multiple season type values
    if (seasonType && seasonType !== 'all') {
      const seasonTypes = Array.isArray(seasonType) ? seasonType : [seasonType];
      if (seasonTypes.length > 0) {
        whereConditions.push(inArray(products.seasonType, seasonTypes as string[]));
      }
    }

    // Handle multiple speed rating values
    if (speedRating && speedRating !== 'all') {
      const speedRatings = Array.isArray(speedRating) ? speedRating : [speedRating];
      if (speedRatings.length > 0) {
        whereConditions.push(inArray(products.speedRating, speedRatings as string[]));
      }
    }

    // Handle multiple load index values
    if (loadIndex && loadIndex !== 'all') {
      const loadIndexes = Array.isArray(loadIndex) ? loadIndex : [loadIndex];
      if (loadIndexes.length > 0) {
        whereConditions.push(inArray(products.loadIndex, loadIndexes as string[]));
      }
    }

    // Handle multiple tire type values
    if (tireType && tireType !== 'all') {
      const tireTypes = Array.isArray(tireType) ? tireType : [tireType];
      if (tireTypes.length > 0) {
        whereConditions.push(inArray(products.tireType, tireTypes as string[]));
      }
    }

    // Handle construction type
    if (construction && construction !== 'all') {
      const constructions = Array.isArray(construction) ? construction : [construction];
      if (constructions.length > 0) {
        whereConditions.push(inArray(products.construction, constructions as string[]));
      }
    }

    // Category filtering - need to join with productCategories and categories
    let categoryFilterIds: number[] = [];
    if (category && category !== 'all') {
      const categoryFilters = Array.isArray(category) ? category : [category];
      console.log('[DEBUG] Filtering by categories:', categoryFilters);
      
      // Decode URL-encoded category names
      const decodedCategoryFilters = categoryFilters.map(catFilter => {
        const decoded = decodeURIComponent(catFilter as string);
        console.log('[DEBUG] Decoded category filter:', catFilter, '->', decoded);
        return decoded;
      });
      
      // First, find the category ID(s) that match the category names or slugs
      const categoryResults = await db
        .select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(categories)
        .where(or(
          ...decodedCategoryFilters.map(catFilter => 
            or(
              eq(categories.name, catFilter as string),
              eq(categories.slug, catFilter as string)
            )
          )
        ));
      
      console.log('[DEBUG] Category search results:', categoryResults);
      categoryFilterIds = categoryResults.map(c => c.id);
      console.log('[DEBUG] Found category IDs:', categoryFilterIds);
      
      if (categoryFilterIds.length > 0) {
        // Get product ID(s) that belong to these categories
        const productCategoryResults = await db
          .select({ productId: productCategories.productId })
          .from(productCategories)
          .where(inArray(productCategories.categoryId, categoryFilterIds));
        
        const filteredProductIds = productCategoryResults.map(pc => pc.productId);
        console.log('[DEBUG] Products in category:', filteredProductIds);
        
        if (filteredProductIds.length > 0) {
          whereConditions.push(inArray(products.id, filteredProductIds.filter((id: number | null) => id !== null)));
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

    // If search is present, use comprehensive Fuse.js for fuzzy search after filtering by other conditions
    let fuseResults: any[] | null = null;
    let filteredProducts: any[] | null = null;
    if (search) {
      console.log('[API] Using comprehensive Fuse.js for fuzzy search:', search);
      // First, filter products by whereClause
      filteredProducts = await db.select().from(products).where(whereClause);
      console.log('[API] Total products after filters for Fuse.js:', filteredProducts.length);
      // Decode the search query to handle URL encoding
    let searchStr = String(search).toLowerCase();
    if (searchStr.includes('&#x2F;') || searchStr.includes('&#x2f;') || searchStr.includes('&#47;')) {
      const originalSearch = searchStr;
      searchStr = searchStr
        .replace(/&#x2F;/g, '/')
        .replace(/&#x2f;/g, '/')
        .replace(/&#47;/g, '/')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
      console.log('[DEBUG] Decoded search query in main route:', { original: originalSearch, decoded: searchStr });
    }
      
      if (searchStr.length <= 2) {
        // For 1-2 letter queries, show all filtered products
        fuseResults = filteredProducts;
        console.log('[API] Short query, returning all filtered products:', fuseResults.length);
      } else {
        // Use comprehensive Fuse.js search
        const fuse = new Fuse(filteredProducts, {
          keys: [
            'name',
            'brand', 
            'model',
            'size',
            'sku',
            'description',
            'seasonType',
            'tireType',
            'loadIndex',
            'speedRating',
            'tags',
            'features',
            'specifications'
          ],
          threshold: 0.4, // Balanced threshold for good matches
          minMatchCharLength: 2,
          ignoreLocation: true,
          includeScore: true,
          includeMatches: true,
          shouldSort: true,
          // Custom getFn to handle JSON fields and filter out CSS/HTML content
          getFn: (obj, path) => {
            const value = Fuse.config.getFn(obj, path);
            
            // Handle JSON fields (tags, features, specifications)
            if (typeof value === 'string' && (path === 'tags' || path === 'features' || path === 'specifications')) {
              try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                  return parsed.join(' ');
                }
                return JSON.stringify(parsed);
              } catch {
                return value;
              }
            }
            
            // Filter out CSS classes and HTML content from string values
            if (typeof value === 'string') {
              // Decode HTML entities first
              let cleanValue = value
                .replace(/&#x2F;/g, '/') // Convert &#x2F; to /
                .replace(/&#x2f;/g, '/') // Convert &#x2f; to / (lowercase)
                .replace(/&#47;/g, '/') // Convert &#47; to /
                .replace(/&amp;/g, '&') // Convert &amp; to &
                .replace(/&lt;/g, '<') // Convert &lt; to <
                .replace(/&gt;/g, '>') // Convert &gt; to >
                .replace(/&quot;/g, '"') // Convert &quot; to "
                .replace(/&#39;/g, "'") // Convert &#39; to '
                .replace(/&apos;/g, "'"); // Convert &apos; to '
              
              // Remove CSS classes (words starting with . or containing common CSS patterns)
              cleanValue = cleanValue
                .replace(/\.[a-zA-Z0-9_-]+/g, '') // Remove CSS classes like .bg-red-500
                .replace(/[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '') // Remove more CSS patterns
                .replace(/class\s*=\s*["'][^"']*["']/g, '') // Remove class attributes
                .replace(/className\s*=\s*["'][^"']*["']/g, '') // Remove className attributes
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
              
              // Only return if the cleaned value has meaningful content
              if (cleanValue.length > 2) {
                return cleanValue;
              }
            }
            
            return value;
          }
        });
        
        const fuseRaw = fuse.search(searchStr);
        fuseResults = fuseRaw.map((r: any) => r.item);
        
        // Fallback: if Fuse.js returns no results, do a substring match
        if (fuseResults && fuseResults.length === 0) {
          fuseResults = filteredProducts.filter(p =>
            [p.name, p.brand, p.model, p.sku, p.size, p.description].some(field =>
              typeof field === 'string' && field.toLowerCase().includes(searchStr)
            )
          );
          console.log('[API] Fallback substring match results:', fuseResults.length);
        }
        
        console.log('[API] Comprehensive Fuse.js search results:', {
          query: search,
          totalResults: fuseResults?.length,
          topResult: fuseRaw[0]?.item?.name,
          topScore: fuseRaw[0]?.score
        });
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

    // Attach images to each product and add sale status
    const now = new Date();
    const resultWithCategoriesAndImages = resultWithCategories.map(p => {
      const productImages = imagesByProductId[p.id] || [];
      
      // Determine if product is currently on sale
      const hasComparePrice = p.comparePrice && p.comparePrice > p.price;
      const isInSalePeriod = (!p.saleStartDate || new Date(p.saleStartDate) <= now) &&
                            (!p.saleEndDate || new Date(p.saleEndDate) >= now);
      const isOnSale = hasComparePrice && isInSalePeriod;
      
      return {
        ...p,
        productImages,
        images: productImages, // Also include as 'images' for consistency
        isOnSale,
        saleStartDate: p.saleStartDate,
        saleEndDate: p.saleEndDate
      };
    });

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

// GET /api/products/brands - Get all unique brands with product counts
router.get('/brands', async (req: express.Request, res: express.Response) => {
  try {
    const result = await db.select({
      brand: products.brand,
      productCount: count(products.id),
    })
    .from(products)
    .where(eq(products.status, 'published'))
    .groupBy(products.brand)
    .orderBy(asc(products.brand));
    
    // Normalize brand names and merge duplicates
    const brandMap = new Map<string, { brand: string; productCount: number }>();
    
    result.forEach(item => {
      if (!item.brand) return;
      
      // Normalize brand name (title case for consistency)
      const normalizedBrand = item.brand
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      if (brandMap.has(normalizedBrand)) {
        // Merge with existing brand
        const existing = brandMap.get(normalizedBrand)!;
        existing.productCount += item.productCount;
      } else {
        // Add new brand
        brandMap.set(normalizedBrand, {
          brand: normalizedBrand,
          productCount: item.productCount
        });
      }
    });
    
    // Convert back to array and sort
    const normalizedBrands = Array.from(brandMap.values())
      .sort((a, b) => a.brand.localeCompare(b.brand));
    
    res.json({ brands: normalizedBrands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// GET /api/products/brands/:brand - Get products by specific brand
router.get('/brands/:brand', async (req: express.Request, res: express.Response) => {
  try {
    const { brand } = req.params;
    
    const result = await db.select()
      .from(products)
      .where(and(
        eq(products.status, 'published'),
        ilike(products.brand, brand)
      ));
    
    // Attach images to products
    const productIds = result.map(p => p.id);
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
    
    const resultWithImages = result.map(p => ({
      ...p,
      productImages: imagesByProductId[p.id] || [],
      images: imagesByProductId[p.id] || []
    }));
    
    res.json({ products: resultWithImages });
  } catch (error) {
    console.error('Error fetching brand products:', error);
    res.status(500).json({ error: 'Failed to fetch brand products' });
  }
});

// GET /api/products/categories/:category - Get products by specific category
router.get('/categories/:category', async (req: express.Request, res: express.Response) => {
  try {
    const { category } = req.params;
    
    // First, find the category by slug
    const categoryData = await db.select().from(categories).where(eq(categories.slug, category));
    
    if (!categoryData.length) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const categoryId = categoryData[0].id;
    
    const result = await db.select({
      // Product fields
      id: products.id,
      name: products.name,
      brand: products.brand,
      model: products.model,
      size: products.size,
      price: products.price,
      comparePrice: products.comparePrice,
      stock: products.stock,
      status: products.status,
      featured: products.featured,
      sku: products.sku,
      slug: products.slug,
      description: products.description,
      features: products.features,
      specifications: products.specifications,
      tags: products.tags,
      
      loadIndex: products.loadIndex,
      speedRating: products.speedRating,
      seasonType: products.seasonType,
      tireType: products.tireType,
      tireSoundVolume: products.tireSoundVolume,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      // Image info
      imageUrl: productImages.imageUrl,
      imageAltText: productImages.altText,
      imageIsMain: productImages.isPrimary,
    })
    .from(products)
    .leftJoin(productImages, eq(products.id, productImages.productId))
    .leftJoin(productCategories, eq(products.id, productCategories.productId))
    .where(and(
      eq(products.status, 'published'),
      eq(productCategories.categoryId, categoryId)
    ));
    
    // Group by product and collect images
    const productsWithImages = result.reduce((acc: any[], row: any) => {
      const existingProduct = acc.find(p => p.id === row.id);
      if (existingProduct) {
        if (row.imageUrl) {
          existingProduct.images.push({
            imageUrl: row.imageUrl,
            altText: row.imageAltText,
            isPrimary: row.imageIsMain
          });
        }
      } else {
        const product = {
          id: row.id,
          name: row.name,
          brand: row.brand,
          model: row.model,
          size: row.size,
          price: row.price,
          comparePrice: row.comparePrice,
          stock: row.stock,
          status: row.status,
          featured: row.featured,
          sku: row.sku,
          slug: row.slug,
          description: row.description,
          features: row.features,
          specifications: row.specifications,
          tags: row.tags,
          tireWidth: row.tireWidth,
          aspectRatio: row.aspectRatio,
          rimDiameter: row.rimDiameter,
          loadIndex: row.loadIndex,
          speedRating: row.speedRating,
          seasonType: row.seasonType,
          tireType: row.tireType,
          tireSoundVolume: row.tireSoundVolume,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          images: row.imageUrl ? [{
            imageUrl: row.imageUrl,
            altText: row.imageAltText,
            isPrimary: row.imageIsMain
          }] : []
        };
        acc.push(product);
      }
      return acc;
    }, []);
    
    res.json({ products: productsWithImages });
  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({ error: 'Failed to fetch category products' });
  }
});

// GET /api/products/on-sale - Get products with compare price (on sale)
router.get('/on-sale', paginationValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const now = new Date();
    
    const result = await db.select()
      .from(products)
      .where(eq(products.status, 'published'));
    
    // Filter products that are currently on sale based on sale dates and compare price
    const onSaleProducts = result.filter(product => {
      // Check if product has a compare price greater than current price
      const hasComparePrice = product.comparePrice && product.comparePrice > product.price;
      
      // Check if product is within sale period
      const isInSalePeriod = (!product.saleStartDate || new Date(product.saleStartDate) <= now) &&
                            (!product.saleEndDate || new Date(product.saleEndDate) >= now);
      
      return hasComparePrice && isInSalePeriod;
    });
    
    // Attach images to products
    const productIds = onSaleProducts.map(p => p.id);
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
    
    const resultWithImages = onSaleProducts.map(p => ({
      ...p,
      productImages: imagesByProductId[p.id] || [],
      images: imagesByProductId[p.id] || []
    }));
    
    res.json({ products: resultWithImages });
  } catch (error) {
    console.error('Error fetching on-sale products:', error);
    res.status(500).json({ error: 'Failed to fetch on-sale products' });
  }
});

// GET /api/products/new-arrivals - Get recently created products
router.get('/new-arrivals', paginationValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await db.select()
      .from(products)
      .where(eq(products.status, 'published'))
      .orderBy(desc(products.createdAt));
    
    // Filter products created in the last 30 days
    const newArrivals = result.filter(product => {
      if (!product.createdAt) return false;
      const productDate = new Date(product.createdAt);
      return productDate >= thirtyDaysAgo;
    });
    
    // Attach images to products
    const productIds = newArrivals.map(p => p.id);
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
    
    const resultWithImages = newArrivals.map(p => ({
      ...p,
      productImages: imagesByProductId[p.id] || [],
      images: imagesByProductId[p.id] || []
    }));
    
    res.json({ products: resultWithImages });
  } catch (error) {
    console.error('Error fetching new arrivals:', error);
    res.status(500).json({ error: 'Failed to fetch new arrivals' });
  }
});

// GET /api/products/slug/:slug - Get product by slug
router.get('/slug/:slug', async (req: express.Request, res: express.Response) => {
  try {
    const { slug } = req.params;
    
    const product = await db
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
        slug: products.slug,
        description: products.description,
        features: products.features,
        specifications: products.specifications,
        tags: products.tags,
        // Tire-specific fields
        
        loadIndex: products.loadIndex,
        speedRating: products.speedRating,
        seasonType: products.seasonType,
        tireType: products.tireType,
        treadDepth: products.treadDepth,
        construction: products.construction,
        tireSoundVolume: products.tireSoundVolume,
        // SEO fields
        seoTitle: products.seoTitle,
        seoDescription: products.seoDescription,
        // Timestamps
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);

    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get product images
    const images = await db
      .select({
        id: productImages.id,
        imageUrl: productImages.imageUrl,
        altText: productImages.altText,
        isPrimary: productImages.isPrimary,
        sortOrder: productImages.sortOrder,
      })
      .from(productImages)
      .where(eq(productImages.productId, product[0].id))
      .orderBy(asc(productImages.sortOrder), asc(productImages.id));

    // Get product categories
    const categoriesForProduct = await db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        categorySlug: categories.slug,
        categoryDescription: categories.description,
      })
      .from(categories)
      .innerJoin(productCategories, eq(categories.id, productCategories.categoryId))
      .where(eq(productCategories.productId, product[0].id));

    const result = {
      ...product[0],
      images: images,
      categories: categoriesForProduct,
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching product by slug:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
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

        // Determine if product is currently on sale
        const now = new Date();
        const hasComparePrice = result[0].comparePrice && result[0].comparePrice > result[0].price;
        const isInSalePeriod = (!result[0].saleStartDate || new Date(result[0].saleStartDate) <= now) &&
                              (!result[0].saleEndDate || new Date(result[0].saleEndDate) >= now);
        const isOnSale = hasComparePrice && isInSalePeriod;

        const product = {
          ...result[0],
          productImages: images,
          images: images, // Also include as 'images' for consistency
          categories: categoriesForProduct,
          seoTitle: result[0].seoTitle || '',
          seoDescription: result[0].seoDescription || '',
          isOnSale,
          saleStartDate: result[0].saleStartDate,
          saleEndDate: result[0].saleEndDate,
          tireSoundVolume: result[0].tireSoundVolume || null
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
    console.log('🆕 Creating new product with data:', JSON.stringify(req.body, null, 2));
    console.log('🚗 Vehicle Type/Tire Type in creation:', { tireType: req.body.tireType, vehicleType: req.body.vehicleType });
    console.log('🖼️ Images received in request:', req.body.images || req.body.productImages);

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
      slug,
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
      treadDepth,
      construction,
      tireSoundVolume,
      // Sale fields
      saleStartDate,
      saleEndDate,
      // SEO fields
      seoTitle,
      seoDescription,
      // Images and categories
      productImages: productImagesData,
      images,
      categoryIds = []
    } = req.body;


    // Generate SKU if not provided
    const finalSku = sku || `${brand.substring(0, 3).toUpperCase()}-${model.substring(0, 3).toUpperCase()}-${size.replace(/[\/]/g, '-')}`;

    // Auto-generate size from tire dimensions if provided
    let finalSize = size;
    if (tireWidth && aspectRatio && rimDiameter) {
      finalSize = `${tireWidth}/${aspectRatio}R${rimDiameter}`;
    }

    // Generate slug if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      // Get existing slugs to avoid conflicts
      const existingProducts = await db.select({ slug: products.slug }).from(products);
      const existingSlugs = existingProducts
        .map(p => p.slug)
        .filter((slug): slug is string => slug !== null);
      finalSlug = generateProductSlug(brand, name, finalSize, existingSlugs);
    }

    const insertData = {
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
      slug: finalSlug,
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
      treadDepth: treadDepth || null,
      construction: construction || null,
      tireSoundVolume: tireSoundVolume || null,
      // Sale fields
      saleStartDate: saleStartDate ? new Date(saleStartDate) : null,
      saleEndDate: saleEndDate ? new Date(saleEndDate) : null,
      // SEO fields
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      updatedAt: new Date(),
    };
    
    console.log('🗄️ Database insert data:', JSON.stringify(insertData, null, 2));
    console.log('🚗 Tire Type being inserted:', insertData.tireType);
    
    const newProduct = await db.insert(products).values(insertData).returning();

    // Debug: log newProduct result
    console.log('🟢 newProduct result:', newProduct);
    if (!newProduct || !Array.isArray(newProduct) || !newProduct[0] || typeof newProduct[0].id === 'undefined') {
      console.error('❌ newProduct[0].id is undefined! Cannot insert images.');
    }

    // Handle both 'images' and 'productImages' fields for backward compatibility
    const newImages = productImagesData || images;

    // Insert product images if provided
    if (newImages && Array.isArray(newImages) && newImages.length > 0) {
      console.log(`🖼️ Creating images for new product:`, {
        productId: newProduct[0]?.id,
        imagesCount: newImages.length,
        images: newImages
      });
      try {
        const imageInserts = newImages.map((img: any, index: number) => {
          const imageUrl = img.url || img.imageUrl; // Support both field names
          const pid = newProduct[0]?.id;
          console.log(`🖼️ Processing image ${index}:`, { url: imageUrl, altText: img.altText, productId: pid });
          return {
            productId: pid,
            imageUrl: imageUrl,
            altText: img.altText || `${name} - Image ${index + 1}`,
            isPrimary: index === 0,
            sortOrder: index,
          };
        });
        console.log('🖼️ About to insert images:', imageInserts);
        const insertResult = await db.insert(productImages).values(imageInserts).returning();
        console.log(`✅ Successfully inserted ${Array.isArray(insertResult) ? insertResult.length : 0} images for product:`, insertResult);
      } catch (imageError: any) {
        console.error('❌ Error inserting product images:', imageError);
        console.error('❌ Error details:', {
          message: imageError instanceof Error ? imageError.message : String(imageError) || 'Unknown error',
          stack: imageError instanceof Error ? imageError.stack : 'No stack trace',
          code: (imageError as any)?.code || 'No error code'
        });
        // Don't fail the entire creation if image insertion fails
      }
    } else {
      console.log('📝 No images provided for new product');
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
    console.log('🔄 Updating product with data:', JSON.stringify(req.body, null, 2));
    console.log('🚗 Vehicle Type/Tire Type in update:', { tireType: req.body.tireType, vehicleType: req.body.vehicleType });
    console.log('🖼️ Raw images data for update:', { productImages: req.body.productImages, images: req.body.images });
    console.log('🟢 Received images:', req.body.images);
    const {
      productImages: productImagesData,
      images,
      categoryIds,
      tireWidth,
      aspectRatio,
      rimDiameter,
      size: providedSize,
      price,
      comparePrice,
      slug,
      tireSoundVolume,
      ...otherData
    } = req.body;
    
    // Handle both 'images' and 'productImages' fields for backward compatibility
    const newImages = productImagesData || images;
    
    // Auto-generate size from tire dimensions if provided
    let finalSize = providedSize;
    if (tireWidth && aspectRatio && rimDiameter) {
      finalSize = `${tireWidth}/${aspectRatio}R${rimDiameter}`;
    }

    // Check for SKU uniqueness if SKU is being updated
    if (otherData.sku) {
      const existingProduct = await db.select()
        .from(products)
        .where(and(
          eq(products.sku, otherData.sku),
          ne(products.id, productId)
        ));
      
      if (existingProduct.length > 0) {
        return res.status(400).json({ 
          error: 'SKU already exists', 
          details: `SKU "${otherData.sku}" is already used by another product` 
        });
      }
    }

    // Check for slug uniqueness if slug is being updated
    if (slug) {
      const existingProduct = await db.select()
        .from(products)
        .where(and(
          eq(products.slug, slug),
          ne(products.id, productId)
        ));
      
      if (existingProduct.length > 0) {
        return res.status(400).json({ 
          error: 'Slug already exists', 
          details: `Slug "${slug}" is already used by another product` 
        });
      }
    }

    const updateData = {
      ...otherData,
      size: finalSize,
      price: price ? price.toString() : undefined,
      comparePrice: comparePrice ? comparePrice.toString() : null,
      slug: slug || undefined,
      // Tire-specific fields
      tireWidth: tireWidth || null,
      aspectRatio: aspectRatio || null,
      rimDiameter: rimDiameter || null,
      loadIndex: otherData.loadIndex || null,
      speedRating: otherData.speedRating || null,
      seasonType: otherData.seasonType || null,
      tireType: otherData.tireType || null,
      treadDepth: otherData.treadDepth || null,
      construction: otherData.construction || null,
      tireSoundVolume: tireSoundVolume || null,
      // Sale fields
      saleStartDate: otherData.saleStartDate ? new Date(otherData.saleStartDate) : null,
      saleEndDate: otherData.saleEndDate ? new Date(otherData.saleEndDate) : null,
      updatedAt: new Date()
    };
    
    console.log('🗄️ Database update data:', JSON.stringify(updateData, null, 2));
    console.log('🚗 Tire Type being updated:', updateData.tireType);

    const result = await db.update(products)
      .set(updateData)
      .where(eq(products.id, productId))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update product images if provided
    if (newImages && Array.isArray(newImages)) {
      console.log(`🖼️ Updating images for product ${productId}:`, newImages.length, 'images');
      console.log('🖼️ Image data:', newImages);
      try {
        // Delete existing images
        await db.delete(productImages).where(eq(productImages.productId, productId));
        console.log(`🗑️ Deleted existing images for product ${productId}`);
        // Insert new images
        if (newImages.length > 0) {
          const imageInserts = newImages.map((img: any, index: number) => {
            const imageUrl = img.url || img.imageUrl; // Support both field names
            const fallbackName = req.body.name || `Product ${productId}`;
            const insertObj = {
              productId: productId,
              imageUrl: imageUrl,
              altText: img.altText || `${fallbackName} - Image ${index + 1}`,
              isPrimary: index === 0,
              sortOrder: index,
            };
            console.log(`🖼️ Processing image ${index}:`, insertObj);
            return insertObj;
          });
          // Validate all imageInserts
          const validImageInserts = imageInserts.filter(img => img.productId && img.imageUrl);
          if (validImageInserts.length !== imageInserts.length) {
            console.error('❌ Some imageInserts are invalid:', imageInserts);
          }
          try {
            console.log('🟡 Attempting to insert images for productId:', productId);
            console.log('🟡 validImageInserts:', validImageInserts);
            const insertResult = await db.insert(productImages).values(validImageInserts).returning();
            console.log('🟢 Insert result:', insertResult, '| type:', Array.isArray(insertResult) ? 'array' : typeof insertResult);
            if (!insertResult || (Array.isArray(insertResult) && insertResult.length === 0)) {
              console.error('❌ No images inserted for product', productId);
            } else if (Array.isArray(insertResult)) {
              console.log(`✅ Inserted ${insertResult.length} new images for product ${productId}`);
            } else {
              console.log('✅ Inserted images, but insertResult is not an array:', insertResult);
            }
          } catch (insertErr) {
            console.error('❌ DB insert error for product images:', insertErr);
          }
        }
      } catch (imageError) {
        console.error('❌ Error updating product images:', imageError);
        if (imageError && typeof imageError === 'object') {
          const errObj = imageError as { message?: string; stack?: string; code?: string };
          console.error('❌ Error details:', {
            message: errObj.message || 'Unknown error',
            stack: errObj.stack || 'No stack trace',
            code: errObj.code || 'No error code'
          });
        } else {
          console.error('❌ Error details: Unknown error type');
        }
        // Don't fail the entire update if image update fails
      }
    } else {
      console.log('📝 No images provided for product update');
    }

    // Update product categories if provided
    if (categoryIds && Array.isArray(categoryIds)) {
      // Delete existing product-category relationships
      await db.delete(productCategories).where(eq(productCategories.productId, productId));
      
      // Insert new product-category relationships
      if (categoryIds.length > 0) {
        await db.insert(productCategories).values(
          categoryIds.map((categoryId: string | number) => ({
            productId,
            categoryId: Number(categoryId)
          }))
        );
      }
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('❌ Error updating product:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      productId: req.params.id,
      bodyKeys: Object.keys(req.body)
    });
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('unique')) {
        res.status(400).json({ error: 'SKU already exists' });
      } else if (error.message.includes('foreign key')) {
        res.status(400).json({ error: 'Invalid category or product reference' });
      } else {
        res.status(500).json({ error: 'Failed to update product', details: error.message });
      }
    } else {
      res.status(500).json({ error: 'Failed to update product' });
    }
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
    
    // Attach images to featured products
    const productIds = result.map(p => p.id);
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
    
    const resultWithImages = result.map(p => ({
      ...p,
      productImages: imagesByProductId[p.id] || [],
      images: imagesByProductId[p.id] || [] // Also include as 'images' for consistency
    }));
    
    res.json({ products: resultWithImages });
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
    // Attach category relationships for badge system
    let categoryIdsByProductId: Record<number, number[]> = {};
    if (productIds.length > 0) {
      const productCategoryResults = await db.select().from(productCategories).where(inArray(productCategories.productId, productIds));
      categoryIdsByProductId = productCategoryResults
        .filter((pc: any) => pc.productId !== null && pc.categoryId !== null)
        .reduce((acc: Record<number, number[]>, pc: any) => {
          if (pc.productId !== null && pc.categoryId !== null) {
            if (!acc[pc.productId]) acc[pc.productId] = [];
            acc[pc.productId].push(pc.categoryId);
          }
          return acc;
        }, {});
    }
    
    const relatedWithImages = relatedProducts.map((p: any) => ({
      ...p,
      images: imagesByProductId[p.id] || [],
      productImages: imagesByProductId[p.id] || [], // Also include as productImages for consistency
      categoryIds: categoryIdsByProductId[p.id] || [],
      // Add isOnSale logic for badge system
      isOnSale: p.comparePrice && parseFloat(p.comparePrice) > parseFloat(p.price)
    }));
    res.json({ products: relatedWithImages });
  } catch (error) {
    console.error('Error fetching related products:', error);
    res.status(500).json({ error: 'Failed to fetch related products' });
  }
});

export default router;
