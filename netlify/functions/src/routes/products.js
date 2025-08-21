"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const { productCategories, categories } = require('../db/schema');
const fuse_js_1 = __importDefault(require("fuse.js"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
router.get('/search', validation_1.searchValidation, validation_1.handleValidationErrors, async (req, res) => {
    console.log('[DEBUG] /api/products/search route hit. Query:', req.query);
    try {
        const { q, brand } = req.query;
        console.log('[DEBUG] Search params:', { q, brand });
        const search = String(q || '').trim();
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
            description: schema_1.products.description,
            features: schema_1.products.features,
            specifications: schema_1.products.specifications,
            tags: schema_1.products.tags,
            tireWidth: schema_1.products.tireWidth,
            aspectRatio: schema_1.products.aspectRatio,
            rimDiameter: schema_1.products.rimDiameter,
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
            categoryId: categories.id,
            categoryName: categories.name,
            categorySlug: categories.slug,
        })
            .from(schema_1.products)
            .leftJoin(schema_1.productImages, (0, drizzle_orm_1.eq)(schema_1.products.id, schema_1.productImages.productId))
            .leftJoin(productCategories, (0, drizzle_orm_1.eq)(schema_1.products.id, productCategories.productId))
            .leftJoin(categories, (0, drizzle_orm_1.eq)(productCategories.categoryId, categories.id));
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
            if (search.length <= 1) {
                results = filteredProducts.filter(p => [p.name, p.brand, p.model, p.sku].some(field => typeof field === 'string' && field.toLowerCase().includes(search.toLowerCase())));
                console.log('[API] Short query substring match results:', results.length);
            }
            else {
                const fuse = new fuse_js_1.default(filteredProducts, {
                    keys: ['name', 'brand', 'model', 'sku'],
                    threshold: 0.4,
                    minMatchCharLength: 1,
                    ignoreLocation: true,
                    includeScore: true,
                });
                const fuseRaw = fuse.search(search.toLowerCase());
                results = fuseRaw.map((r) => r.item);
                if (results.length === 0) {
                    results = filteredProducts.filter(p => [p.name, p.brand, p.model, p.sku].some(field => typeof field === 'string' && field.toLowerCase().includes(search.toLowerCase())));
                    console.log('[API] Fallback substring match results:', results.length);
                }
                console.log('[API] Fuse.js search string:', search, '| Results:', results.length, '| Top match:', fuseRaw[0]?.item?.name, '| Score:', fuseRaw[0]?.score);
            }
        }
        else if (search && search.length <= 2) {
            results = [];
            console.log('[API] Query too short (<=2), returning empty array.');
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
        const { page = '1', limit = '10', brand, model, size, status, featured, minPrice, maxPrice, search, category, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        console.log('[API] /api/products called', { page, limit, brand, status, featured, minPrice, maxPrice, search, category, sortBy, sortOrder });
        if (category) {
            console.log('[DEBUG] Received category param:', category);
        }
        const whereConditions = [];
        if (brand && brand !== 'all') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.brand, brand));
        }
        if (model && model !== 'all') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.model, model));
        }
        if (size && size !== 'all') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.products.size, size));
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
        let categoryFilterIds = [];
        if (category && category !== 'all') {
            console.log('[DEBUG] Filtering by category:', category);
            const categoryResults = await db_1.db
                .select({ id: categories.id })
                .from(categories)
                .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(categories.name, category), (0, drizzle_orm_1.eq)(categories.slug, category)));
            categoryFilterIds = categoryResults.map(c => c.id);
            console.log('[DEBUG] Found category IDs:', categoryFilterIds);
            if (categoryFilterIds.length > 0) {
                const productCategoryResults = await db_1.db
                    .select({ productId: productCategories.productId })
                    .from(productCategories)
                    .where((0, drizzle_orm_1.inArray)(productCategories.categoryId, categoryFilterIds));
                const filteredProductIds = productCategoryResults.map(pc => pc.productId);
                console.log('[DEBUG] Products in category:', filteredProductIds);
                if (filteredProductIds.length > 0) {
                    whereConditions.push((0, drizzle_orm_1.inArray)(schema_1.products.id, filteredProductIds));
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
            console.log('[API] Using Fuse.js for fuzzy search:', search);
            filteredProducts = await db_1.db.select().from(schema_1.products).where(whereClause);
            console.log('[API] Total products after filters for Fuse.js:', filteredProducts.length);
            const searchStr = String(search).toLowerCase();
            let fuseRaw = [];
            if (searchStr.length <= 2) {
                fuseResults = filteredProducts;
                console.log('[API] Short query, returning all filtered products:', fuseResults.length);
            }
            else {
                const fuse = new fuse_js_1.default(filteredProducts, {
                    keys: ['name', 'brand', 'model', 'sku'],
                    threshold: 0.3,
                    minMatchCharLength: 1,
                    ignoreLocation: true,
                    includeScore: true,
                });
                fuseRaw = fuse.search(searchStr);
                fuseResults = fuseRaw.map((r) => r.item);
                if (fuseResults && fuseResults.length === 0) {
                    fuseResults = filteredProducts.filter(p => [p.name, p.brand, p.model, p.sku].some(field => typeof field === 'string' && field.toLowerCase().includes(searchStr)));
                    console.log('[API] Fallback substring match results:', fuseResults.length);
                }
                console.log('[API] Fuse.js search string:', search, '| Results:', fuseResults?.length, '| Top match:', fuseRaw[0]?.item?.name, '| Score:', fuseRaw[0]?.score);
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
            const rawRows = await db_1.db.select().from(productCategories).where((0, drizzle_orm_1.inArray)(productCategories.productId, productIds));
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
        console.log('[DEBUG] Filtered products:', resultWithCategories.map(p => ({ id: p.id, name: p.name, categoryIds: p.categoryIds })));
        res.json({
            products: resultWithCategories,
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
        const prodCatRows = await db_1.db.select().from(productCategories).where((0, drizzle_orm_1.eq)(productCategories.productId, productId));
        const categoryIds = prodCatRows.map((pc) => pc.categoryId);
        let categoriesForProduct = [];
        if (categoryIds.length > 0) {
            categoriesForProduct = await db_1.db.select().from(categories).where((0, drizzle_orm_1.inArray)(categories.id, categoryIds));
        }
        const product = {
            ...result[0],
            productImages: images,
            categories: categoriesForProduct,
            seoTitle: result[0].seoTitle || '',
            seoDescription: result[0].seoDescription || ''
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
        const { name, brand, model, size, price, comparePrice, stock, lowStockThreshold, status = 'draft', featured = false, sku, description, features, specifications, tags, tireWidth, aspectRatio, rimDiameter, loadIndex, speedRating, seasonType, tireType, seoTitle, seoDescription, productImages: newImages = [], categoryIds = [] } = req.body;
        const finalSku = sku || `${brand.substring(0, 3).toUpperCase()}-${model.substring(0, 3).toUpperCase()}-${size.replace(/[\/]/g, '-')}`;
        let finalSize = size;
        if (tireWidth && aspectRatio && rimDiameter) {
            finalSize = `${tireWidth}/${aspectRatio}R${rimDiameter}`;
        }
        const newProduct = await db_1.db.insert(schema_1.products).values({
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
            tireWidth: tireWidth || null,
            aspectRatio: aspectRatio || null,
            rimDiameter: rimDiameter || null,
            loadIndex: loadIndex || null,
            speedRating: speedRating || null,
            seasonType: seasonType || null,
            tireType: tireType || null,
            seoTitle: seoTitle || null,
            seoDescription: seoDescription || null,
            updatedAt: new Date(),
        }).returning();
        if (newImages.length > 0) {
            const imageInserts = newImages.map((img, index) => ({
                productId: newProduct[0].id,
                imageUrl: img.url || img.imageUrl,
                altText: img.altText || `${name} - Image ${index + 1}`,
                isPrimary: index === 0,
                sortOrder: index,
            }));
            await db_1.db.insert(schema_1.productImages).values(imageInserts);
        }
        if (categoryIds && categoryIds.length > 0) {
            await db_1.db.insert(productCategories).values(categoryIds.map((categoryId) => ({
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
        const { productImages: newImages, categoryIds, tireWidth, aspectRatio, rimDiameter, size: providedSize, price, comparePrice, ...otherData } = req.body;
        let finalSize = providedSize;
        if (tireWidth && aspectRatio && rimDiameter) {
            finalSize = `${tireWidth}/${aspectRatio}R${rimDiameter}`;
        }
        const updateData = {
            ...otherData,
            size: finalSize,
            price: price ? price.toString() : undefined,
            comparePrice: comparePrice ? comparePrice.toString() : null,
            tireWidth: tireWidth || null,
            aspectRatio: aspectRatio || null,
            rimDiameter: rimDiameter || null,
            updatedAt: new Date()
        };
        const result = await db_1.db.update(schema_1.products)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.products.id, productId))
            .returning();
        if (result.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        if (newImages && Array.isArray(newImages)) {
            await db_1.db.delete(schema_1.productImages).where((0, drizzle_orm_1.eq)(schema_1.productImages.productId, productId));
            if (newImages.length > 0) {
                const imageInserts = newImages.map((img, index) => ({
                    productId: productId,
                    imageUrl: img.url || img.imageUrl,
                    altText: img.altText || `${result[0].name} - Image ${index + 1}`,
                    isPrimary: index === 0,
                    sortOrder: index,
                }));
                await db_1.db.insert(schema_1.productImages).values(imageInserts);
            }
        }
        if (categoryIds && Array.isArray(categoryIds)) {
            await db_1.db.delete(productCategories).where((0, drizzle_orm_1.eq)(productCategories.productId, productId));
            if (categoryIds.length > 0) {
                await db_1.db.insert(productCategories).values(categoryIds.map((categoryId) => ({
                    productId,
                    categoryId
                })));
            }
        }
        res.json(result[0]);
    }
    catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
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
        res.json({ products: result });
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
        const relatedWithImages = relatedProducts.map((p) => ({
            ...p,
            images: imagesByProductId[p.id] || []
        }));
        res.json({ products: relatedWithImages });
    }
    catch (error) {
        console.error('Error fetching related products:', error);
        res.status(500).json({ error: 'Failed to fetch related products' });
    }
});
exports.default = router;
