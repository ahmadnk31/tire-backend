"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const fuse_js_1 = __importDefault(require("fuse.js"));
const slugGenerator_1 = require("../utils/slugGenerator");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
router.get('/search', validation_1.searchValidation, validation_1.handleValidationErrors, async (req, res) => {
    console.log('[DEBUG] /api/products/search route hit. Query:', req.query);
    try {
        const { q, brand } = req.query;
        console.log('[DEBUG] Search params:', { q, brand });
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
        console.log('[DEBUG] Query params:', req.query);
        console.log('[DEBUG] Search term:', search);
        console.log('[DEBUG] Brand filter:', brandFilter);
        const allProducts = await db_1.db
            .select({
            id: schema_1.products.id,
            name: schema_1.products.name,
            brand: schema_1.products.brand,
            model: schema_1.products.model,
            size: schema_1.products.size,
            price: schema_1.products.price,
            comparePrice: schema_1.products.comparePrice,
            stock: schema_1.products.stock,
            lowStockThreshold: schema_1.products.lowStockThreshold,
            status: schema_1.products.status,
            featured: schema_1.products.featured,
            sku: schema_1.products.sku,
            slug: schema_1.products.slug,
            description: schema_1.products.description,
            features: schema_1.products.features,
            specifications: schema_1.products.specifications,
            tags: schema_1.products.tags,
            loadIndex: schema_1.products.loadIndex,
            speedRating: schema_1.products.speedRating,
            seasonType: schema_1.products.seasonType,
            tireType: schema_1.products.tireType,
            seoTitle: schema_1.products.seoTitle,
            seoDescription: schema_1.products.seoDescription,
            createdAt: schema_1.products.createdAt,
            updatedAt: schema_1.products.updatedAt,
            imageUrl: schema_1.productImages.imageUrl,
            imageAltText: schema_1.productImages.altText,
            imageIsMain: schema_1.productImages.isPrimary,
            categoryId: schema_1.categories.id,
            categoryName: schema_1.categories.name,
            categorySlug: schema_1.categories.slug,
        })
            .from(schema_1.products)
            .leftJoin(schema_1.productImages, (0, drizzle_orm_1.eq)(schema_1.products.id, schema_1.productImages.productId))
            .leftJoin(schema_1.productCategories, (0, drizzle_orm_1.eq)(schema_1.products.id, schema_1.productCategories.productId))
            .leftJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.productCategories.categoryId, schema_1.categories.id));
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
            if (row.imageUrl && !product.images.some((img) => img.imageUrl === row.imageUrl)) {
                product.images.push({
                    imageUrl: row.imageUrl,
                    altText: row.imageAltText,
                    isPrimary: row.imageIsMain
                });
            }
            if (row.categoryId && !product.categories.some((cat) => cat.id === row.categoryId)) {
                product.categories.push({
                    id: row.categoryId,
                    name: row.categoryName,
                    slug: row.categorySlug
                });
            }
        });
        const productsWithRelations = Array.from(productsMap.values()).map(p => {
            const { imageUrl, imageAltText, imageIsMain, categoryId, categoryName, categorySlug, ...cleanProduct } = p;
            return cleanProduct;
        });
        const safeProducts = productsWithRelations.map(p => ({
            ...p,
            brand: typeof p.brand === 'string' ? p.brand : (p.brand ? String(p.brand) : ''),
            name: typeof p.name === 'string' ? p.name : (p.name ? String(p.name) : ''),
            model: typeof p.model === 'string' ? p.model : (p.model ? String(p.model) : ''),
            sku: typeof p.sku === 'string' ? p.sku : (p.sku ? String(p.sku) : ''),
        }));
        console.log('[DEBUG] Total products in DB:', safeProducts.length);
        let filteredProducts = safeProducts;
        if (brandFilter && brandFilter !== 'all') {
            filteredProducts = filteredProducts.filter(p => typeof p.brand === 'string' && p.brand.toLowerCase() === brandFilter.toLowerCase());
            console.log('[API] Filtered by brand:', brandFilter, '| Results:', filteredProducts.length);
        }
        if (search && search.length > 0) {
            const debugMatches = filteredProducts.filter(p => [p.name, p.brand, p.model, p.sku].some(field => typeof field === 'string' && field.toLowerCase().includes(search.toLowerCase())));
            console.log('[DEBUG] Products matching search term before Fuse.js:', debugMatches.map(p => ({ id: p.id, name: p.name, brand: p.brand, model: p.model, sku: p.sku, status: p.status })));
        }
        let results = filteredProducts;
        if (search && search.length > 0) {
            console.log('[API] Performing comprehensive Fuse.js search for:', search);
            console.log('[DEBUG] Search query details:', {
                original: search,
                length: search.length,
                containsHtmlEntities: search.includes('&#'),
                containsForwardSlash: search.includes('/'),
                containsAmpersand: search.includes('&')
            });
            const fuse = new fuse_js_1.default(filteredProducts, {
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
                threshold: 0.4,
                minMatchCharLength: 2,
                ignoreLocation: true,
                includeScore: true,
                includeMatches: true,
                shouldSort: true,
                getFn: (obj, path) => {
                    const value = fuse_js_1.default.config.getFn(obj, path);
                    if (typeof value === 'string' && (path === 'tags' || path === 'features' || path === 'specifications')) {
                        try {
                            const parsed = JSON.parse(value);
                            if (Array.isArray(parsed)) {
                                return parsed.join(' ');
                            }
                            return JSON.stringify(parsed);
                        }
                        catch {
                            return value;
                        }
                    }
                    if (typeof value === 'string') {
                        let cleanValue = value
                            .replace(/&#x2F;/g, '/')
                            .replace(/&#x2f;/g, '/')
                            .replace(/&#47;/g, '/')
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/&apos;/g, "'");
                        cleanValue = cleanValue
                            .replace(/\.[a-zA-Z0-9_-]+/g, '')
                            .replace(/[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '')
                            .replace(/class\s*=\s*["'][^"']*["']/g, '')
                            .replace(/className\s*=\s*["'][^"']*["']/g, '')
                            .replace(/<[^>]*>/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                        if (cleanValue.length > 2) {
                            return cleanValue;
                        }
                    }
                    return value;
                }
            });
            const fuseResults = fuse.search(search);
            console.log('[API] Fuse.js raw results:', fuseResults.length);
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
            results = fuseResults.map(result => ({
                ...result.item,
                searchScore: result.score,
                searchMatches: result.matches
            }));
            if (results.length === 0) {
                console.log('[API] No Fuse.js results, trying fallback substring search');
                results = filteredProducts.filter(p => [p.name, p.brand, p.model, p.sku, p.size, p.description].some(field => typeof field === 'string' && field.toLowerCase().includes(search.toLowerCase())));
                console.log('[API] Fallback substring match results:', results.length);
            }
            console.log('[API] Final search results:', {
                query: search,
                totalResults: results.length,
                topResult: results[0]?.name,
                topScore: results[0]?.searchScore
            });
        }
        const productIds = results.map(p => p.id);
        let imagesByProductId = {};
        if (productIds.length > 0) {
            const images = await db_1.db.select().from(schema_1.productImages).where((0, drizzle_orm_1.inArray)(schema_1.productImages.productId, productIds));
            imagesByProductId = images
                .filter(img => img.productId !== null)
                .reduce((acc, img) => {
                if (!acc[img.productId])
                    acc[img.productId] = [];
                acc[img.productId].push(img);
                return acc;
            }, {});
        }
        const resultsWithImages = results.map(p => ({
            ...p,
            images: imagesByProductId[p.id] || []
        }));
        res.json({ products: resultsWithImages });
    }
    catch (error) {
        const stack = (error instanceof Error && error.stack) ? error.stack : '';
        console.error('Error in /api/products/search:', error, '| Query:', req.query, '| Stack:', stack);
        res.status(500).json({ error: 'Failed to search products' });
    }
});
router.get('/', validation_1.advancedSearchValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const { page = '1', limit = '10', brand, model, size, status, featured, minPrice, maxPrice, search, category, seasonType, speedRating, loadIndex, tireType, construction, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        console.log('[API] /api/products called', { page, limit, brand, status, featured, minPrice, maxPrice, search, category, sortBy, sortOrder });
        if (category) {
            console.log('[DEBUG] Received category param:', category);
        }
        const whereConditions = [];
        if (brand && brand !== 'all') {
            const brands = Array.isArray(brand) ? brand : [brand];
            if (brands.length > 0) {
                whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.brand, brands));
            }
        }
        if (model && model !== 'all') {
            const models = Array.isArray(model) ? model : [model];
            if (models.length > 0) {
                whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.model, models));
            }
        }
        if (size && size !== 'all') {
            const sizes = Array.isArray(size) ? size : [size];
            if (sizes.length > 0) {
                whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.size, sizes));
            }
        }
        if (status && status !== 'all') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.status, status));
        }
        if (featured === 'true') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.featured, true));
        }
        if (minPrice) {
            whereConditions.push((0, drizzle_orm_1.gte)(schema_1.products.price, minPrice));
        }
        if (maxPrice) {
            whereConditions.push((0, drizzle_orm_1.lte)(schema_1.products.price, maxPrice));
        }
        if (seasonType && seasonType !== 'all') {
            const seasonTypes = Array.isArray(seasonType) ? seasonType : [seasonType];
            if (seasonTypes.length > 0) {
                whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.seasonType, seasonTypes));
            }
        }
        if (speedRating && speedRating !== 'all') {
            const speedRatings = Array.isArray(speedRating) ? speedRating : [speedRating];
            if (speedRatings.length > 0) {
                whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.speedRating, speedRatings));
            }
        }
        if (loadIndex && loadIndex !== 'all') {
            const loadIndexes = Array.isArray(loadIndex) ? loadIndex : [loadIndex];
            if (loadIndexes.length > 0) {
                whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.loadIndex, loadIndexes));
            }
        }
        if (tireType && tireType !== 'all') {
            const tireTypes = Array.isArray(tireType) ? tireType : [tireType];
            if (tireTypes.length > 0) {
                whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.tireType, tireTypes));
            }
        }
        if (construction && construction !== 'all') {
            const constructions = Array.isArray(construction) ? construction : [construction];
            if (constructions.length > 0) {
                whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.construction, constructions));
            }
        }
        let categoryFilterIds = [];
        if (category && category !== 'all') {
            const categoryFilters = Array.isArray(category) ? category : [category];
            console.log('[DEBUG] Filtering by categories:', categoryFilters);
            const decodedCategoryFilters = categoryFilters.map(catFilter => {
                const decoded = decodeURIComponent(catFilter);
                console.log('[DEBUG] Decoded category filter:', catFilter, '->', decoded);
                return decoded;
            });
            const categoryResults = await db_1.db
                .select({ id: schema_1.categories.id, name: schema_1.categories.name, slug: schema_1.categories.slug })
                .from(schema_1.categories)
                .where((0, drizzle_orm_1.or)(...decodedCategoryFilters.map(catFilter => (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.categories.name, catFilter), (0, drizzle_orm_1.eq)(schema_1.categories.slug, catFilter)))));
            console.log('[DEBUG] Category search results:', categoryResults);
            categoryFilterIds = categoryResults.map(c => c.id);
            console.log('[DEBUG] Found category IDs:', categoryFilterIds);
            if (categoryFilterIds.length > 0) {
                const productCategoryResults = await db_1.db
                    .select({ productId: schema_1.productCategories.productId })
                    .from(schema_1.productCategories)
                    .where((0, drizzle_orm_1.inArray)(schema_1.productCategories.categoryId, categoryFilterIds));
                const filteredProductIds = productCategoryResults.map(pc => pc.productId);
                console.log('[DEBUG] Products in category:', filteredProductIds);
                if (filteredProductIds.length > 0) {
                    whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.id, filteredProductIds.filter((id) => id !== null)));
                }
                else {
                    whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.id, -1));
                }
            }
            else {
                console.log('[DEBUG] Category not found:', category);
                whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.id, -1));
            }
        }
        const whereClause = whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined;
        let fuseResults = null;
        let filteredProducts = null;
        if (search) {
            console.log('[API] Using comprehensive Fuse.js for fuzzy search:', search);
            filteredProducts = await db_1.db.select().from(schema_1.products).where(whereClause);
            console.log('[API] Total products after filters for Fuse.js:', filteredProducts.length);
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
                fuseResults = filteredProducts;
                console.log('[API] Short query, returning all filtered products:', fuseResults.length);
            }
            else {
                const fuse = new fuse_js_1.default(filteredProducts, {
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
                    threshold: 0.4,
                    minMatchCharLength: 2,
                    ignoreLocation: true,
                    includeScore: true,
                    includeMatches: true,
                    shouldSort: true,
                    getFn: (obj, path) => {
                        const value = fuse_js_1.default.config.getFn(obj, path);
                        if (typeof value === 'string' && (path === 'tags' || path === 'features' || path === 'specifications')) {
                            try {
                                const parsed = JSON.parse(value);
                                if (Array.isArray(parsed)) {
                                    return parsed.join(' ');
                                }
                                return JSON.stringify(parsed);
                            }
                            catch {
                                return value;
                            }
                        }
                        if (typeof value === 'string') {
                            let cleanValue = value
                                .replace(/&#x2F;/g, '/')
                                .replace(/&#x2f;/g, '/')
                                .replace(/&#47;/g, '/')
                                .replace(/&amp;/g, '&')
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .replace(/&quot;/g, '"')
                                .replace(/&#39;/g, "'")
                                .replace(/&apos;/g, "'");
                            cleanValue = cleanValue
                                .replace(/\.[a-zA-Z0-9_-]+/g, '')
                                .replace(/[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '')
                                .replace(/class\s*=\s*["'][^"']*["']/g, '')
                                .replace(/className\s*=\s*["'][^"']*["']/g, '')
                                .replace(/<[^>]*>/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                            if (cleanValue.length > 2) {
                                return cleanValue;
                            }
                        }
                        return value;
                    }
                });
                const fuseRaw = fuse.search(searchStr);
                fuseResults = fuseRaw.map((r) => r.item);
                if (fuseResults && fuseResults.length === 0) {
                    fuseResults = filteredProducts.filter(p => [p.name, p.brand, p.model, p.sku, p.size, p.description].some(field => typeof field === 'string' && field.toLowerCase().includes(searchStr)));
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
        let totalProducts;
        if (fuseResults && fuseResults.length > 0) {
            totalProducts = fuseResults.length;
        }
        else {
            const totalCountResult = await db_1.db
                .select({ count: (0, drizzle_orm_1.count)() })
                .from(schema_1.products)
                .where(whereClause);
            totalProducts = totalCountResult[0]?.count || 0;
        }
        const sortOptions = {
            'name': schema_1.products.name,
            'price': schema_1.products.price,
            'brand': schema_1.products.brand,
            'createdAt': schema_1.products.createdAt,
            'stock': schema_1.products.stock,
            'rating': schema_1.products.rating
        };
        const sortColumn = sortOptions[sortBy] || schema_1.products.createdAt;
        const orderBy = sortOrder === 'desc' ? (0, drizzle_orm_1.desc)(sortColumn) : (0, drizzle_orm_1.asc)(sortColumn);
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        let result;
        if (fuseResults) {
            result = fuseResults.slice(offset, offset + limitNum);
            console.log('[API] Returning paginated Fuse.js results:', result.length);
        }
        else {
            result = await db_1.db
                .select()
                .from(schema_1.products)
                .where(whereClause)
                .orderBy(orderBy)
                .limit(limitNum)
                .offset(offset);
            console.log('[API] Returning DB query results:', result.length);
        }
        const brandsResult = await db_1.db.selectDistinct({ brand: schema_1.products.brand }).from(schema_1.products);
        const statusesResult = await db_1.db.selectDistinct({ status: schema_1.products.status }).from(schema_1.products);
        const priceResult = await db_1.db.select({
            price: schema_1.products.price
        }).from(schema_1.products);
        const prices = priceResult.map(p => parseFloat(p.price || '0')).filter(p => p > 0);
        const minPriceResult = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPriceResult = prices.length > 0 ? Math.max(...prices) : 0;
        const productIds = result.map(p => p.id);
        let prodCatRows = [];
        if (productIds.length > 0) {
            const rawRows = await db_1.db.select().from(schema_1.productCategories).where((0, drizzle_orm_1.inArray)(schema_1.productCategories.productId, productIds));
            prodCatRows = rawRows.map((row) => ({ productId: row.productId, categoryId: row.categoryId }));
        }
        const categoryIdsByProductId = {};
        prodCatRows.forEach(pc => {
            if (!categoryIdsByProductId[pc.productId])
                categoryIdsByProductId[pc.productId] = [];
            categoryIdsByProductId[pc.productId].push(pc.categoryId);
        });
        const resultWithCategories = result.map(p => ({
            ...p,
            categoryIds: categoryIdsByProductId[p.id] || [],
            seoTitle: p.seoTitle || '',
            seoDescription: p.seoDescription || ''
        }));
        let imagesByProductId = {};
        if (productIds.length > 0) {
            const images = await db_1.db.select().from(schema_1.productImages).where((0, drizzle_orm_1.inArray)(schema_1.productImages.productId, productIds));
            imagesByProductId = images
                .filter(img => img.productId !== null)
                .reduce((acc, img) => {
                if (!acc[img.productId])
                    acc[img.productId] = [];
                acc[img.productId].push(img);
                return acc;
            }, {});
        }
        const now = new Date();
        const resultWithCategoriesAndImages = resultWithCategories.map(p => {
            const productImages = imagesByProductId[p.id] || [];
            const hasComparePrice = p.comparePrice && p.comparePrice > p.price;
            const isInSalePeriod = (!p.saleStartDate || new Date(p.saleStartDate) <= now) &&
                (!p.saleEndDate || new Date(p.saleEndDate) >= now);
            const isOnSale = hasComparePrice && isInSalePeriod;
            return {
                ...p,
                productImages,
                images: productImages,
                isOnSale,
                saleStartDate: p.saleStartDate,
                saleEndDate: p.saleEndDate
            };
        });
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
    }
    catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});
router.get('/brands', async (req, res) => {
    try {
        const result = await db_1.db.select({
            brand: schema_1.products.brand,
            productCount: (0, drizzle_orm_1.count)(schema_1.products.id),
        })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.status, 'published'))
            .groupBy(schema_1.products.brand)
            .orderBy((0, drizzle_orm_1.asc)(schema_1.products.brand));
        const brandMap = new Map();
        result.forEach(item => {
            if (!item.brand)
                return;
            const normalizedBrand = item.brand
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            if (brandMap.has(normalizedBrand)) {
                const existing = brandMap.get(normalizedBrand);
                existing.productCount += item.productCount;
            }
            else {
                brandMap.set(normalizedBrand, {
                    brand: normalizedBrand,
                    productCount: item.productCount
                });
            }
        });
        const normalizedBrands = Array.from(brandMap.values())
            .sort((a, b) => a.brand.localeCompare(b.brand));
        res.json({ brands: normalizedBrands });
    }
    catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: 'Failed to fetch brands' });
    }
});
router.get('/brands/:brand', async (req, res) => {
    try {
        const { brand } = req.params;
        const result = await db_1.db.select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.status, 'published'), (0, drizzle_orm_1.ilike)(schema_1.products.brand, brand)));
        const productIds = result.map(p => p.id);
        let imagesByProductId = {};
        if (productIds.length > 0) {
            const images = await db_1.db.select().from(schema_1.productImages).where((0, drizzle_orm_1.inArray)(schema_1.productImages.productId, productIds));
            imagesByProductId = images
                .filter(img => img.productId !== null)
                .reduce((acc, img) => {
                if (!acc[img.productId])
                    acc[img.productId] = [];
                acc[img.productId].push(img);
                return acc;
            }, {});
        }
        const resultWithImages = result.map(p => ({
            ...p,
            productImages: imagesByProductId[p.id] || [],
            images: imagesByProductId[p.id] || []
        }));
        res.json({ products: resultWithImages });
    }
    catch (error) {
        console.error('Error fetching brand products:', error);
        res.status(500).json({ error: 'Failed to fetch brand products' });
    }
});
router.get('/categories/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const categoryData = await db_1.db.select().from(schema_1.categories).where((0, drizzle_orm_1.eq)(schema_1.categories.slug, category));
        if (!categoryData.length) {
            return res.status(404).json({ error: 'Category not found' });
        }
        const categoryId = categoryData[0].id;
        const result = await db_1.db.select({
            id: schema_1.products.id,
            name: schema_1.products.name,
            brand: schema_1.products.brand,
            model: schema_1.products.model,
            size: schema_1.products.size,
            price: schema_1.products.price,
            comparePrice: schema_1.products.comparePrice,
            stock: schema_1.products.stock,
            status: schema_1.products.status,
            featured: schema_1.products.featured,
            sku: schema_1.products.sku,
            slug: schema_1.products.slug,
            description: schema_1.products.description,
            features: schema_1.products.features,
            specifications: schema_1.products.specifications,
            tags: schema_1.products.tags,
            loadIndex: schema_1.products.loadIndex,
            speedRating: schema_1.products.speedRating,
            seasonType: schema_1.products.seasonType,
            tireType: schema_1.products.tireType,
            tireSoundVolume: schema_1.products.tireSoundVolume,
            createdAt: schema_1.products.createdAt,
            updatedAt: schema_1.products.updatedAt,
            imageUrl: schema_1.productImages.imageUrl,
            imageAltText: schema_1.productImages.altText,
            imageIsMain: schema_1.productImages.isPrimary,
        })
            .from(schema_1.products)
            .leftJoin(schema_1.productImages, (0, drizzle_orm_1.eq)(schema_1.products.id, schema_1.productImages.productId))
            .leftJoin(schema_1.productCategories, (0, drizzle_orm_1.eq)(schema_1.products.id, schema_1.productCategories.productId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.status, 'published'), (0, drizzle_orm_1.eq)(schema_1.productCategories.categoryId, categoryId)));
        const productsWithImages = result.reduce((acc, row) => {
            const existingProduct = acc.find(p => p.id === row.id);
            if (existingProduct) {
                if (row.imageUrl) {
                    existingProduct.images.push({
                        imageUrl: row.imageUrl,
                        altText: row.imageAltText,
                        isPrimary: row.imageIsMain
                    });
                }
            }
            else {
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
    }
    catch (error) {
        console.error('Error fetching category products:', error);
        res.status(500).json({ error: 'Failed to fetch category products' });
    }
});
router.get('/on-sale', validation_1.paginationValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const now = new Date();
        const result = await db_1.db.select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.status, 'published'));
        const onSaleProducts = result.filter(product => {
            const hasComparePrice = product.comparePrice && product.comparePrice > product.price;
            const isInSalePeriod = (!product.saleStartDate || new Date(product.saleStartDate) <= now) &&
                (!product.saleEndDate || new Date(product.saleEndDate) >= now);
            return hasComparePrice && isInSalePeriod;
        });
        const productIds = onSaleProducts.map(p => p.id);
        let imagesByProductId = {};
        if (productIds.length > 0) {
            const images = await db_1.db.select().from(schema_1.productImages).where((0, drizzle_orm_1.inArray)(schema_1.productImages.productId, productIds));
            imagesByProductId = images
                .filter(img => img.productId !== null)
                .reduce((acc, img) => {
                if (!acc[img.productId])
                    acc[img.productId] = [];
                acc[img.productId].push(img);
                return acc;
            }, {});
        }
        const resultWithImages = onSaleProducts.map(p => ({
            ...p,
            productImages: imagesByProductId[p.id] || [],
            images: imagesByProductId[p.id] || []
        }));
        res.json({ products: resultWithImages });
    }
    catch (error) {
        console.error('Error fetching on-sale products:', error);
        res.status(500).json({ error: 'Failed to fetch on-sale products' });
    }
});
router.get('/new-arrivals', validation_1.paginationValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const result = await db_1.db.select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.status, 'published'))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.products.createdAt));
        const newArrivals = result.filter(product => {
            if (!product.createdAt)
                return false;
            const productDate = new Date(product.createdAt);
            return productDate >= thirtyDaysAgo;
        });
        const productIds = newArrivals.map(p => p.id);
        let imagesByProductId = {};
        if (productIds.length > 0) {
            const images = await db_1.db.select().from(schema_1.productImages).where((0, drizzle_orm_1.inArray)(schema_1.productImages.productId, productIds));
            imagesByProductId = images
                .filter(img => img.productId !== null)
                .reduce((acc, img) => {
                if (!acc[img.productId])
                    acc[img.productId] = [];
                acc[img.productId].push(img);
                return acc;
            }, {});
        }
        const resultWithImages = newArrivals.map(p => ({
            ...p,
            productImages: imagesByProductId[p.id] || [],
            images: imagesByProductId[p.id] || []
        }));
        res.json({ products: resultWithImages });
    }
    catch (error) {
        console.error('Error fetching new arrivals:', error);
        res.status(500).json({ error: 'Failed to fetch new arrivals' });
    }
});
router.get('/slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const product = await db_1.db
            .select({
            id: schema_1.products.id,
            name: schema_1.products.name,
            brand: schema_1.products.brand,
            model: schema_1.products.model,
            size: schema_1.products.size,
            price: schema_1.products.price,
            comparePrice: schema_1.products.comparePrice,
            stock: schema_1.products.stock,
            lowStockThreshold: schema_1.products.lowStockThreshold,
            status: schema_1.products.status,
            featured: schema_1.products.featured,
            sku: schema_1.products.sku,
            slug: schema_1.products.slug,
            description: schema_1.products.description,
            features: schema_1.products.features,
            specifications: schema_1.products.specifications,
            tags: schema_1.products.tags,
            loadIndex: schema_1.products.loadIndex,
            speedRating: schema_1.products.speedRating,
            seasonType: schema_1.products.seasonType,
            tireType: schema_1.products.tireType,
            treadDepth: schema_1.products.treadDepth,
            construction: schema_1.products.construction,
            tireSoundVolume: schema_1.products.tireSoundVolume,
            seoTitle: schema_1.products.seoTitle,
            seoDescription: schema_1.products.seoDescription,
            createdAt: schema_1.products.createdAt,
            updatedAt: schema_1.products.updatedAt,
        })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.slug, slug))
            .limit(1);
        if (product.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const images = await db_1.db
            .select({
            id: schema_1.productImages.id,
            imageUrl: schema_1.productImages.imageUrl,
            altText: schema_1.productImages.altText,
            isPrimary: schema_1.productImages.isPrimary,
            sortOrder: schema_1.productImages.sortOrder,
        })
            .from(schema_1.productImages)
            .where((0, drizzle_orm_1.eq)(schema_1.productImages.productId, product[0].id))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.productImages.sortOrder), (0, drizzle_orm_1.asc)(schema_1.productImages.id));
        const categoriesForProduct = await db_1.db
            .select({
            categoryId: schema_1.categories.id,
            categoryName: schema_1.categories.name,
            categorySlug: schema_1.categories.slug,
            categoryDescription: schema_1.categories.description,
        })
            .from(schema_1.categories)
            .innerJoin(schema_1.productCategories, (0, drizzle_orm_1.eq)(schema_1.categories.id, schema_1.productCategories.categoryId))
            .where((0, drizzle_orm_1.eq)(schema_1.productCategories.productId, product[0].id));
        const result = {
            ...product[0],
            images: images,
            categories: categoriesForProduct,
        };
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching product by slug:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});
router.get('/:id', validation_1.idParamValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (!req.params.id || isNaN(productId) || !Number.isFinite(productId)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }
        const result = await db_1.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, productId));
        if (result.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const images = await db_1.db.select().from(schema_1.productImages)
            .where((0, drizzle_orm_1.eq)(schema_1.productImages.productId, productId))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.productImages.sortOrder));
        const prodCatRows = await db_1.db.select().from(schema_1.productCategories).where((0, drizzle_orm_1.eq)(schema_1.productCategories.productId, productId));
        const categoryIds = prodCatRows.map((pc) => pc.categoryId);
        let categoriesForProduct = [];
        if (categoryIds.length > 0) {
            categoriesForProduct = await db_1.db.select().from(schema_1.categories).where((0, drizzle_orm_1.inArray)(schema_1.categories.id, categoryIds));
        }
        const now = new Date();
        const hasComparePrice = result[0].comparePrice && result[0].comparePrice > result[0].price;
        const isInSalePeriod = (!result[0].saleStartDate || new Date(result[0].saleStartDate) <= now) &&
            (!result[0].saleEndDate || new Date(result[0].saleEndDate) >= now);
        const isOnSale = hasComparePrice && isInSalePeriod;
        const product = {
            ...result[0],
            productImages: images,
            images: images,
            categories: categoriesForProduct,
            seoTitle: result[0].seoTitle || '',
            seoDescription: result[0].seoDescription || '',
            isOnSale,
            saleStartDate: result[0].saleStartDate,
            saleEndDate: result[0].saleEndDate,
            tireSoundVolume: result[0].tireSoundVolume || null
        };
        res.json(product);
    }
    catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});
router.post('/', auth_1.requireAuth, auth_1.requireAdmin, validation_1.productValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        console.log('🆕 Creating new product with data:', JSON.stringify(req.body, null, 2));
        console.log('🚗 Vehicle Type/Tire Type in creation:', { tireType: req.body.tireType, vehicleType: req.body.vehicleType });
        console.log('🖼️ Images received in request:', req.body.images || req.body.productImages);
        const { name, brand, model, size, price, comparePrice, stock, lowStockThreshold, status = 'draft', featured = false, sku, slug, description, features, specifications, tags, tireWidth, aspectRatio, rimDiameter, loadIndex, speedRating, seasonType, tireType, treadDepth, construction, tireSoundVolume, saleStartDate, saleEndDate, seoTitle, seoDescription, productImages: productImagesData, images, categoryIds = [] } = req.body;
        const finalSku = sku || `${brand.substring(0, 3).toUpperCase()}-${model.substring(0, 3).toUpperCase()}-${size.replace(/[\/]/g, '-')}`;
        let finalSize = size;
        if (tireWidth && aspectRatio && rimDiameter) {
            finalSize = `${tireWidth}/${aspectRatio}R${rimDiameter}`;
        }
        let finalSlug = slug;
        if (!finalSlug) {
            const existingProducts = await db_1.db.select({ slug: schema_1.products.slug }).from(schema_1.products);
            const existingSlugs = existingProducts
                .map(p => p.slug)
                .filter((slug) => slug !== null);
            finalSlug = (0, slugGenerator_1.generateProductSlug)(brand, name, finalSize, existingSlugs);
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
            saleStartDate: saleStartDate ? new Date(saleStartDate) : null,
            saleEndDate: saleEndDate ? new Date(saleEndDate) : null,
            seoTitle: seoTitle || null,
            seoDescription: seoDescription || null,
            updatedAt: new Date(),
        };
        console.log('🗄️ Database insert data:', JSON.stringify(insertData, null, 2));
        console.log('🚗 Tire Type being inserted:', insertData.tireType);
        const newProduct = await db_1.db.insert(schema_1.products).values(insertData).returning();
        console.log('🟢 newProduct result:', newProduct);
        if (!newProduct || !Array.isArray(newProduct) || !newProduct[0] || typeof newProduct[0].id === 'undefined') {
            console.error('❌ newProduct[0].id is undefined! Cannot insert images.');
        }
        const newImages = productImagesData || images;
        if (newImages && Array.isArray(newImages) && newImages.length > 0) {
            console.log(`🖼️ Creating images for new product:`, {
                productId: newProduct[0]?.id,
                imagesCount: newImages.length,
                images: newImages
            });
            try {
                const imageInserts = newImages.map((img, index) => {
                    const imageUrl = img.url || img.imageUrl;
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
                const insertResult = await db_1.db.insert(schema_1.productImages).values(imageInserts).returning();
                console.log(`✅ Successfully inserted ${Array.isArray(insertResult) ? insertResult.length : 0} images for product:`, insertResult);
            }
            catch (imageError) {
                console.error('❌ Error inserting product images:', imageError);
                console.error('❌ Error details:', {
                    message: imageError instanceof Error ? imageError.message : String(imageError) || 'Unknown error',
                    stack: imageError instanceof Error ? imageError.stack : 'No stack trace',
                    code: imageError?.code || 'No error code'
                });
            }
        }
        else {
            console.log('📝 No images provided for new product');
        }
        if (categoryIds && categoryIds.length > 0) {
            await db_1.db.insert(schema_1.productCategories).values(categoryIds.map((categoryId) => ({
                productId: newProduct[0].id,
                categoryId
            })));
        }
        res.status(201).json(newProduct[0]);
    }
    catch (error) {
        console.error('Error creating product:', error);
        if (error instanceof Error && error.message.includes('unique')) {
            res.status(400).json({ error: 'SKU already exists' });
        }
        else {
            res.status(500).json({ error: 'Failed to create product' });
        }
    }
});
router.put('/:id', auth_1.requireAuth, auth_1.requireAdmin, validation_1.idParamValidation, validation_1.productValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        console.log('🔄 Updating product with data:', JSON.stringify(req.body, null, 2));
        console.log('🚗 Vehicle Type/Tire Type in update:', { tireType: req.body.tireType, vehicleType: req.body.vehicleType });
        console.log('🖼️ Raw images data for update:', { productImages: req.body.productImages, images: req.body.images });
        console.log('🟢 Received images:', req.body.images);
        const { productImages: productImagesData, images, categoryIds, tireWidth, aspectRatio, rimDiameter, size: providedSize, price, comparePrice, slug, tireSoundVolume, ...otherData } = req.body;
        const newImages = productImagesData || images;
        let finalSize = providedSize;
        if (tireWidth && aspectRatio && rimDiameter) {
            finalSize = `${tireWidth}/${aspectRatio}R${rimDiameter}`;
        }
        if (otherData.sku) {
            const existingProduct = await db_1.db.select()
                .from(schema_1.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.sku, otherData.sku), (0, drizzle_orm_1.ne)(schema_1.products.id, productId)));
            if (existingProduct.length > 0) {
                return res.status(400).json({
                    error: 'SKU already exists',
                    details: `SKU "${otherData.sku}" is already used by another product`
                });
            }
        }
        if (slug) {
            const existingProduct = await db_1.db.select()
                .from(schema_1.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.slug, slug), (0, drizzle_orm_1.ne)(schema_1.products.id, productId)));
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
            saleStartDate: otherData.saleStartDate ? new Date(otherData.saleStartDate) : null,
            saleEndDate: otherData.saleEndDate ? new Date(otherData.saleEndDate) : null,
            updatedAt: new Date()
        };
        console.log('🗄️ Database update data:', JSON.stringify(updateData, null, 2));
        console.log('🚗 Tire Type being updated:', updateData.tireType);
        const result = await db_1.db.update(schema_1.products)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId))
            .returning();
        if (result.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        if (newImages && Array.isArray(newImages)) {
            console.log(`🖼️ Updating images for product ${productId}:`, newImages.length, 'images');
            console.log('🖼️ Image data:', newImages);
            try {
                await db_1.db.delete(schema_1.productImages).where((0, drizzle_orm_1.eq)(schema_1.productImages.productId, productId));
                console.log(`🗑️ Deleted existing images for product ${productId}`);
                if (newImages.length > 0) {
                    const imageInserts = newImages.map((img, index) => {
                        const imageUrl = img.url || img.imageUrl;
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
                    const validImageInserts = imageInserts.filter(img => img.productId && img.imageUrl);
                    if (validImageInserts.length !== imageInserts.length) {
                        console.error('❌ Some imageInserts are invalid:', imageInserts);
                    }
                    try {
                        console.log('🟡 Attempting to insert images for productId:', productId);
                        console.log('🟡 validImageInserts:', validImageInserts);
                        const insertResult = await db_1.db.insert(schema_1.productImages).values(validImageInserts).returning();
                        console.log('🟢 Insert result:', insertResult, '| type:', Array.isArray(insertResult) ? 'array' : typeof insertResult);
                        if (!insertResult || (Array.isArray(insertResult) && insertResult.length === 0)) {
                            console.error('❌ No images inserted for product', productId);
                        }
                        else if (Array.isArray(insertResult)) {
                            console.log(`✅ Inserted ${insertResult.length} new images for product ${productId}`);
                        }
                        else {
                            console.log('✅ Inserted images, but insertResult is not an array:', insertResult);
                        }
                    }
                    catch (insertErr) {
                        console.error('❌ DB insert error for product images:', insertErr);
                    }
                }
            }
            catch (imageError) {
                console.error('❌ Error updating product images:', imageError);
                if (imageError && typeof imageError === 'object') {
                    const errObj = imageError;
                    console.error('❌ Error details:', {
                        message: errObj.message || 'Unknown error',
                        stack: errObj.stack || 'No stack trace',
                        code: errObj.code || 'No error code'
                    });
                }
                else {
                    console.error('❌ Error details: Unknown error type');
                }
            }
        }
        else {
            console.log('📝 No images provided for product update');
        }
        if (categoryIds && Array.isArray(categoryIds)) {
            await db_1.db.delete(schema_1.productCategories).where((0, drizzle_orm_1.eq)(schema_1.productCategories.productId, productId));
            if (categoryIds.length > 0) {
                await db_1.db.insert(schema_1.productCategories).values(categoryIds.map((categoryId) => ({
                    productId,
                    categoryId: Number(categoryId)
                })));
            }
        }
        res.json(result[0]);
    }
    catch (error) {
        console.error('❌ Error updating product:', error);
        console.error('❌ Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack trace',
            productId: req.params.id,
            bodyKeys: Object.keys(req.body)
        });
        if (error instanceof Error) {
            if (error.message.includes('unique')) {
                res.status(400).json({ error: 'SKU already exists' });
            }
            else if (error.message.includes('foreign key')) {
                res.status(400).json({ error: 'Invalid category or product reference' });
            }
            else {
                res.status(500).json({ error: 'Failed to update product', details: error.message });
            }
        }
        else {
            res.status(500).json({ error: 'Failed to update product' });
        }
    }
});
router.delete('/:id', auth_1.requireAuth, auth_1.requireAdmin, validation_1.idParamValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const result = await db_1.db.delete(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId))
            .returning();
        if (result.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});
router.get('/featured/list', validation_1.paginationValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const result = await db_1.db.select()
            .from(schema_1.products)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.products.featured, true), (0, drizzle_orm_1.eq)(schema_1.products.status, 'published')));
        const productIds = result.map(p => p.id);
        let imagesByProductId = {};
        if (productIds.length > 0) {
            const images = await db_1.db.select().from(schema_1.productImages).where((0, drizzle_orm_1.inArray)(schema_1.productImages.productId, productIds));
            imagesByProductId = images
                .filter(img => img.productId !== null)
                .reduce((acc, img) => {
                if (!acc[img.productId])
                    acc[img.productId] = [];
                acc[img.productId].push(img);
                return acc;
            }, {});
        }
        const resultWithImages = result.map(p => ({
            ...p,
            productImages: imagesByProductId[p.id] || [],
            images: imagesByProductId[p.id] || []
        }));
        res.json({ products: resultWithImages });
    }
    catch (error) {
        console.error('Error fetching featured products:', error);
        res.status(500).json({ error: 'Failed to fetch featured products' });
    }
});
router.get('/:id/related', validation_1.idParamValidation, validation_1.handleValidationErrors, async (req, res) => {
    try {
        const { eq, and, ne, or } = require('drizzle-orm');
        const productId = Number(req.params.id);
        if (!req.params.id || isNaN(productId) || !Number.isFinite(productId)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }
        const result = await db_1.db.select().from(schema_1.products).where(eq(schema_1.products.id, productId));
        if (result.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const mainProduct = result[0];
        const whereRelated = [];
        if (mainProduct.brand) {
            whereRelated.push(and(eq(schema_1.products.brand, mainProduct.brand), ne(schema_1.products.id, productId)));
        }
        if (mainProduct.model) {
            whereRelated.push(and(eq(schema_1.products.model, mainProduct.model), ne(schema_1.products.id, productId)));
        }
        if (mainProduct.size) {
            whereRelated.push(and(eq(schema_1.products.size, mainProduct.size), ne(schema_1.products.id, productId)));
        }
        let relatedProducts = [];
        if (whereRelated.length > 0) {
            relatedProducts = await db_1.db.select().from(schema_1.products).where(or(...whereRelated)).limit(12);
        }
        const productIds = relatedProducts.map(p => p.id);
        let imagesByProductId = {};
        if (productIds.length > 0) {
            const images = await db_1.db.select().from(schema_1.productImages).where((0, drizzle_orm_1.inArray)(schema_1.productImages.productId, productIds));
            imagesByProductId = images
                .filter(img => img.productId !== null && img.productId !== undefined)
                .reduce((acc, img) => {
                if (img.productId !== null && img.productId !== undefined) {
                    if (!acc[img.productId])
                        acc[img.productId] = [];
                    acc[img.productId].push(img);
                }
                return acc;
            }, {});
        }
        let categoryIdsByProductId = {};
        if (productIds.length > 0) {
            const productCategoryResults = await db_1.db.select().from(schema_1.productCategories).where((0, drizzle_orm_1.inArray)(schema_1.productCategories.productId, productIds));
            categoryIdsByProductId = productCategoryResults
                .filter((pc) => pc.productId !== null && pc.categoryId !== null)
                .reduce((acc, pc) => {
                if (pc.productId !== null && pc.categoryId !== null) {
                    if (!acc[pc.productId])
                        acc[pc.productId] = [];
                    acc[pc.productId].push(pc.categoryId);
                }
                return acc;
            }, {});
        }
        const relatedWithImages = relatedProducts.map((p) => ({
            ...p,
            images: imagesByProductId[p.id] || [],
            productImages: imagesByProductId[p.id] || [],
            categoryIds: categoryIdsByProductId[p.id] || [],
            isOnSale: p.comparePrice && parseFloat(p.comparePrice) > parseFloat(p.price)
        }));
        res.json({ products: relatedWithImages });
    }
    catch (error) {
        console.error('Error fetching related products:', error);
        res.status(500).json({ error: 'Failed to fetch related products' });
    }
});
exports.default = router;
