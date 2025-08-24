"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const drizzle_orm_1 = require("drizzle-orm");
const s3Service_1 = __importDefault(require("../services/s3Service"));
const router = express_1.default.Router();
const s3Service = new s3Service_1.default();
router.get('/stats/:productId', async (req, res) => {
    console.log('🔍 [REVIEWS API] GET /stats/:productId called');
    try {
        const { productId } = req.params;
        const totalCount = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.productId, Number(productId)));
        const avgRating = await db_1.db
            .select({ avg: (0, drizzle_orm_1.avg)(schema_1.productReviews.rating) })
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.productId, Number(productId)));
        const averageRating = avgRating[0].avg !== null ? Number(avgRating[0].avg) : 0;
        const ratingDistribution = await db_1.db
            .select({
            rating: schema_1.productReviews.rating,
            count: (0, drizzle_orm_1.count)()
        })
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.productId, Number(productId)))
            .groupBy(schema_1.productReviews.rating);
        const ratingDist = ratingDistribution.reduce((acc, item) => {
            acc[item.rating] = Number(item.count);
            return acc;
        }, {});
        const response = {
            stats: {
                averageRating: averageRating,
                totalReviews: totalCount[0].count,
                ratingDistribution: ratingDist,
            },
        };
        console.log('✅ [REVIEWS API] Stats response:', response);
        res.json(response);
    }
    catch (error) {
        console.error('❌ [REVIEWS API] Error fetching review stats:', error);
        res.status(500).json({ error: 'Failed to fetch review stats' });
    }
});
router.get('/test', async (req, res) => {
    console.log('🧪 [REVIEWS API] Test endpoint called');
    try {
        const testReviews = await db_1.db
            .select({
            id: schema_1.productReviews.id,
            productId: schema_1.productReviews.productId,
            status: schema_1.productReviews.status,
            title: schema_1.productReviews.title,
        })
            .from(schema_1.productReviews)
            .limit(5);
        console.log('🧪 [REVIEWS API] Test query result:', testReviews);
        res.json({
            message: 'Reviews API is working!',
            timestamp: new Date().toISOString(),
            testData: testReviews,
            routes: {
                'GET /test': 'Test endpoint',
                'GET /product/:productId': 'Get product reviews',
                'POST /': 'Create review',
                'PUT /:reviewId': 'Update review',
                'DELETE /:reviewId': 'Delete review'
            }
        });
    }
    catch (error) {
        console.error('🧪 [REVIEWS API] Test query error:', error);
        res.status(500).json({ error: 'Test query failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.get('/product/:productId', async (req, res) => {
    console.log('🔍 [REVIEWS API] GET /product/:productId called');
    console.log('📋 [REVIEWS API] Request details:', {
        productId: req.params.productId,
        query: req.query,
        headers: {
            'user-agent': req.headers['user-agent'],
            'origin': req.headers.origin,
            'referer': req.headers.referer
        }
    });
    try {
        const { productId } = req.params;
        const { page = 1, limit = 10, sort = 'newest', rating } = req.query;
        console.log('🔧 [REVIEWS API] Processing request with params:', {
            productId: Number(productId),
            page: Number(page),
            limit: Number(limit),
            sort,
            rating: rating ? Number(rating) : null
        });
        const offset = (Number(page) - 1) * Number(limit);
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId = null;
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            }
            catch (error) {
            }
        }
        const whereConditions = [(0, drizzle_orm_1.eq)(schema_1.productReviews.productId, Number(productId))];
        if (userId) {
            const statusCondition = (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.productReviews.status, 'approved'), (0, drizzle_orm_1.eq)(schema_1.productReviews.userId, userId));
            if (statusCondition) {
                whereConditions.push(statusCondition);
            }
        }
        else {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.productReviews.status, 'approved'));
        }
        if (rating) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.productReviews.rating, Number(rating)));
        }
        const finalWhereConditions = whereConditions.length > 0 ? whereConditions : [(0, drizzle_orm_1.eq)(schema_1.productReviews.productId, Number(productId))];
        let orderBy = (0, drizzle_orm_1.desc)(schema_1.productReviews.createdAt);
        if (sort === 'oldest') {
            orderBy = (0, drizzle_orm_1.asc)(schema_1.productReviews.createdAt);
        }
        else if (sort === 'rating') {
            orderBy = (0, drizzle_orm_1.desc)(schema_1.productReviews.rating);
        }
        else if (sort === 'helpful') {
            orderBy = (0, drizzle_orm_1.desc)(schema_1.productReviews.helpfulCount);
        }
        console.log('🗄️ [REVIEWS API] Executing database query with conditions:', whereConditions);
        const reviews = await db_1.db
            .select({
            id: schema_1.productReviews.id,
            rating: schema_1.productReviews.rating,
            title: schema_1.productReviews.title,
            comment: schema_1.productReviews.comment,
            status: schema_1.productReviews.status,
            isVerifiedPurchase: schema_1.productReviews.isVerifiedPurchase,
            helpfulCount: schema_1.productReviews.helpfulCount,
            createdAt: schema_1.productReviews.createdAt,
            user: {
                id: schema_1.users.id,
                name: schema_1.users.name,
            },
            images: schema_1.reviewImages.imageUrl,
        })
            .from(schema_1.productReviews)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.productReviews.userId, schema_1.users.id))
            .leftJoin(schema_1.reviewImages, (0, drizzle_orm_1.eq)(schema_1.productReviews.id, schema_1.reviewImages.reviewId))
            .where((0, drizzle_orm_1.and)(...finalWhereConditions))
            .orderBy(orderBy)
            .limit(Number(limit))
            .offset(offset);
        console.log('📊 [REVIEWS API] Database query completed. Raw results count:', reviews.length);
        const totalCount = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.and)(...finalWhereConditions));
        const avgRating = await db_1.db
            .select({ avg: (0, drizzle_orm_1.avg)(schema_1.productReviews.rating) })
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.and)(...finalWhereConditions));
        const averageRating = avgRating[0].avg !== null ? Number(avgRating[0].avg) : 0;
        const ratingDistribution = await db_1.db
            .select({
            rating: schema_1.productReviews.rating,
            count: (0, drizzle_orm_1.count)()
        })
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.and)(...finalWhereConditions))
            .groupBy(schema_1.productReviews.rating);
        const ratingDist = ratingDistribution.reduce((acc, item) => {
            acc[item.rating] = Number(item.count);
            return acc;
        }, {});
        const groupedReviews = reviews.reduce((acc, review) => {
            const existingReview = acc.find(r => r.id === review.id);
            if (existingReview) {
                if (review.images) {
                    existingReview.images.push(review.images);
                }
            }
            else {
                acc.push({
                    ...review,
                    images: review.images ? [review.images] : [],
                });
            }
            return acc;
        }, []);
        console.log('📈 [REVIEWS API] Statistics calculated:', {
            totalCount: totalCount[0].count,
            averageRating: averageRating,
            ratingDistribution: ratingDist,
            groupedReviewsCount: groupedReviews.length
        });
        const response = {
            reviews: groupedReviews,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount[0].count,
                totalPages: Math.ceil(totalCount[0].count / Number(limit)),
            },
            stats: {
                averageRating: averageRating,
                totalReviews: totalCount[0].count,
                ratingDistribution: ratingDist,
            },
        };
        console.log('✅ [REVIEWS API] Sending response:', response);
        res.json(response);
    }
    catch (error) {
        console.error('❌ [REVIEWS API] Error fetching reviews:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            productId: req.params.productId,
            query: req.query
        });
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});
router.post('/', auth_1.requireAuth, async (req, res) => {
    console.log('🔍 [REVIEWS API] POST / called');
    console.log('📋 [REVIEWS API] Create review request details:', {
        body: req.body,
        bodyType: typeof req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        userId: req.user?.id,
        headers: {
            'content-type': req.headers['content-type'],
            'user-agent': req.headers['user-agent']
        }
    });
    try {
        const { productId, orderId, rating, title, comment, images } = req.body;
        const userId = req.user.id;
        const imageUrls = Array.isArray(images) ? images : [];
        console.log('🔧 [REVIEWS API] Processing review creation with data:', {
            productId,
            orderId,
            rating,
            title,
            comment,
            imagesCount: imageUrls ? imageUrls.length : 0,
            userId
        });
        if (!productId || !rating || rating < 1 || rating > 5) {
            console.log('❌ [REVIEWS API] Validation failed:', { productId, rating });
            return res.status(400).json({ error: 'Product ID and rating (1-5) are required' });
        }
        console.log('✅ [REVIEWS API] Validation passed');
        const product = await db_1.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, productId)).limit(1);
        if (!product.length) {
            console.log('❌ [REVIEWS API] Product not found:', productId);
            return res.status(404).json({ error: 'Product not found' });
        }
        console.log('✅ [REVIEWS API] Product found:', product[0].name);
        const existingReview = await db_1.db
            .select()
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.productReviews.productId, productId), (0, drizzle_orm_1.eq)(schema_1.productReviews.userId, userId)))
            .limit(1);
        if (existingReview.length > 0) {
            return res.status(400).json({ error: 'You have already reviewed this product' });
        }
        let isVerifiedPurchase = false;
        if (orderId) {
            const order = await db_1.db
                .select()
                .from(schema_1.orders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId), (0, drizzle_orm_1.eq)(schema_1.orders.userId, userId)))
                .limit(1);
            if (order.length > 0) {
                isVerifiedPurchase = true;
            }
        }
        console.log('🗄️ [REVIEWS API] Creating review in database...');
        const [newReview] = await db_1.db
            .insert(schema_1.productReviews)
            .values({
            productId: Number(productId),
            userId,
            orderId: orderId ? Number(orderId) : null,
            rating: Number(rating),
            title: title || null,
            comment: comment || null,
            isVerifiedPurchase,
            status: 'pending',
        })
            .returning();
        console.log('✅ [REVIEWS API] Review created successfully:', {
            reviewId: newReview.id,
            productId: newReview.productId,
            userId: newReview.userId,
            rating: newReview.rating
        });
        if (imageUrls && imageUrls.length > 0) {
            console.log('📸 [REVIEWS API] Processing image URLs:', imageUrls.length);
            console.log('📸 [REVIEWS API] Image URLs:', imageUrls);
            const imagePromises = imageUrls.map(async (imageUrl, index) => {
                try {
                    console.log(`🖼️ [REVIEWS API] Processing image URL ${index}:`, imageUrl);
                    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
                        console.log(`❌ [REVIEWS API] Invalid image URL for image ${index}:`, imageUrl);
                        throw new Error('Invalid image URL format');
                    }
                    console.log(`✅ [REVIEWS API] Image URL ${index} processed successfully:`, imageUrl);
                    await db_1.db.insert(schema_1.reviewImages).values({
                        reviewId: newReview.id,
                        imageUrl: imageUrl,
                        altText: `Review image ${index + 1}`,
                        sortOrder: index,
                    });
                }
                catch (error) {
                    console.error(`❌ [REVIEWS API] Error processing image ${index}:`, error);
                    throw error;
                }
            });
            await Promise.all(imagePromises);
            console.log('✅ [REVIEWS API] All images processed successfully');
        }
        const completeReview = await db_1.db
            .select({
            id: schema_1.productReviews.id,
            rating: schema_1.productReviews.rating,
            title: schema_1.productReviews.title,
            comment: schema_1.productReviews.comment,
            isVerifiedPurchase: schema_1.productReviews.isVerifiedPurchase,
            helpfulCount: schema_1.productReviews.helpfulCount,
            createdAt: schema_1.productReviews.createdAt,
            user: {
                id: schema_1.users.id,
                name: schema_1.users.name,
            },
            images: schema_1.reviewImages.imageUrl,
        })
            .from(schema_1.productReviews)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.productReviews.userId, schema_1.users.id))
            .leftJoin(schema_1.reviewImages, (0, drizzle_orm_1.eq)(schema_1.productReviews.id, schema_1.reviewImages.reviewId))
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.id, newReview.id));
        res.status(201).json({
            message: 'Review submitted successfully and pending approval',
            review: completeReview[0],
        });
    }
    catch (error) {
        console.error('Error creating review:', error);
        res.status(500).json({ error: 'Failed to create review' });
    }
});
router.put('/:reviewId', auth_1.requireAuth, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, title, comment, images } = req.body;
        const userId = req.user.id;
        const imageUrls = Array.isArray(images) ? images : [];
        const existingReview = await db_1.db
            .select()
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.productReviews.id, Number(reviewId)), (0, drizzle_orm_1.eq)(schema_1.productReviews.userId, userId)))
            .limit(1);
        if (!existingReview.length) {
            return res.status(404).json({ error: 'Review not found or you do not have permission to edit it' });
        }
        const [updatedReview] = await db_1.db
            .update(schema_1.productReviews)
            .set({
            rating: rating ? Number(rating) : existingReview[0].rating,
            title: title || existingReview[0].title,
            comment: comment || existingReview[0].comment,
            status: 'pending',
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.id, Number(reviewId)))
            .returning();
        if (imageUrls && imageUrls.length > 0) {
            await db_1.db.delete(schema_1.reviewImages).where((0, drizzle_orm_1.eq)(schema_1.reviewImages.reviewId, Number(reviewId)));
            const imagePromises = imageUrls.map(async (imageUrl, index) => {
                try {
                    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
                        console.log(`❌ [REVIEWS API] Invalid image URL for image ${index}:`, imageUrl);
                        throw new Error('Invalid image URL format');
                    }
                    await db_1.db.insert(schema_1.reviewImages).values({
                        reviewId: Number(reviewId),
                        imageUrl: imageUrl,
                        altText: `Review image ${index + 1}`,
                        sortOrder: index,
                    });
                }
                catch (error) {
                    console.error('Error saving review image URL:', error);
                }
            });
            await Promise.all(imagePromises);
        }
        res.json({
            message: 'Review updated successfully and pending approval',
            review: updatedReview,
        });
    }
    catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({ error: 'Failed to update review' });
    }
});
router.delete('/:reviewId', auth_1.requireAuth, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;
        const existingReview = await db_1.db
            .select()
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.productReviews.id, Number(reviewId)), (0, drizzle_orm_1.eq)(schema_1.productReviews.userId, userId)))
            .limit(1);
        if (!existingReview.length) {
            return res.status(404).json({ error: 'Review not found or you do not have permission to delete it' });
        }
        await db_1.db.delete(schema_1.productReviews).where((0, drizzle_orm_1.eq)(schema_1.productReviews.id, Number(reviewId)));
        res.json({ message: 'Review deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
});
router.post('/:reviewId/helpful', auth_1.requireAuth, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;
        const currentReview = await db_1.db
            .select({ helpfulCount: schema_1.productReviews.helpfulCount })
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.id, Number(reviewId)))
            .limit(1);
        if (!currentReview.length) {
            return res.status(404).json({ error: 'Review not found' });
        }
        const existingVote = await db_1.db
            .select()
            .from(schema_1.reviewHelpfulVotes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reviewHelpfulVotes.reviewId, Number(reviewId)), (0, drizzle_orm_1.eq)(schema_1.reviewHelpfulVotes.userId, userId)))
            .limit(1);
        if (existingVote.length > 0) {
            return res.status(400).json({
                error: 'You have already marked this review as helpful',
                helpfulCount: currentReview[0].helpfulCount || 0
            });
        }
        await db_1.db.insert(schema_1.reviewHelpfulVotes).values({
            reviewId: Number(reviewId),
            userId: userId,
        });
        const [updatedReview] = await db_1.db
            .update(schema_1.productReviews)
            .set({
            helpfulCount: (currentReview[0].helpfulCount || 0) + 1,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.id, Number(reviewId)))
            .returning();
        res.json({ helpfulCount: updatedReview.helpfulCount });
    }
    catch (error) {
        console.error('Error marking review as helpful:', error);
        res.status(500).json({ error: 'Failed to mark review as helpful' });
    }
});
router.get('/:reviewId/helpful/check', auth_1.requireAuth, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;
        const existingVote = await db_1.db
            .select()
            .from(schema_1.reviewHelpfulVotes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reviewHelpfulVotes.reviewId, Number(reviewId)), (0, drizzle_orm_1.eq)(schema_1.reviewHelpfulVotes.userId, userId)))
            .limit(1);
        res.json({ hasVoted: existingVote.length > 0 });
    }
    catch (error) {
        console.error('Error checking helpful vote:', error);
        res.status(500).json({ error: 'Failed to check helpful vote' });
    }
});
router.delete('/:reviewId/helpful', auth_1.requireAuth, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;
        const currentReview = await db_1.db
            .select({ helpfulCount: schema_1.productReviews.helpfulCount })
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.id, Number(reviewId)))
            .limit(1);
        if (!currentReview.length) {
            return res.status(404).json({ error: 'Review not found' });
        }
        const existingVote = await db_1.db
            .select()
            .from(schema_1.reviewHelpfulVotes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reviewHelpfulVotes.reviewId, Number(reviewId)), (0, drizzle_orm_1.eq)(schema_1.reviewHelpfulVotes.userId, userId)))
            .limit(1);
        if (existingVote.length === 0) {
            return res.status(400).json({
                error: 'You have not voted for this review',
                helpfulCount: currentReview[0].helpfulCount || 0
            });
        }
        await db_1.db.delete(schema_1.reviewHelpfulVotes).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reviewHelpfulVotes.reviewId, Number(reviewId)), (0, drizzle_orm_1.eq)(schema_1.reviewHelpfulVotes.userId, userId)));
        const [updatedReview] = await db_1.db
            .update(schema_1.productReviews)
            .set({
            helpfulCount: Math.max(0, (currentReview[0].helpfulCount || 0) - 1),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.id, Number(reviewId)))
            .returning();
        res.json({ helpfulCount: updatedReview.helpfulCount });
    }
    catch (error) {
        console.error('Error removing helpful vote:', error);
        res.status(500).json({ error: 'Failed to remove helpful vote' });
    }
});
router.get('/admin/all', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const whereConditions = [];
        if (status && status !== 'all') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.productReviews.status, status));
        }
        const allReviews = await db_1.db
            .select({
            id: schema_1.productReviews.id,
            productId: schema_1.productReviews.productId,
            rating: schema_1.productReviews.rating,
            title: schema_1.productReviews.title,
            comment: schema_1.productReviews.comment,
            status: schema_1.productReviews.status,
            isVerifiedPurchase: schema_1.productReviews.isVerifiedPurchase,
            helpfulCount: schema_1.productReviews.helpfulCount,
            createdAt: schema_1.productReviews.createdAt,
            user: {
                id: schema_1.users.id,
                name: schema_1.users.name,
                email: schema_1.users.email,
            },
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                brand: schema_1.products.brand,
            },
            images: schema_1.reviewImages.imageUrl,
        })
            .from(schema_1.productReviews)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.productReviews.userId, schema_1.users.id))
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.productReviews.productId, schema_1.products.id))
            .leftJoin(schema_1.reviewImages, (0, drizzle_orm_1.eq)(schema_1.productReviews.id, schema_1.reviewImages.reviewId))
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.productReviews.createdAt))
            .limit(Number(limit))
            .offset(offset);
        const totalCount = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.productReviews)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
        console.log('🔍 [REVIEWS API] All reviews raw data:', allReviews);
        res.json({
            reviews: allReviews,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount[0].count,
                totalPages: Math.ceil(totalCount[0].count / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('Error fetching all reviews:', error);
        res.status(500).json({ error: 'Failed to fetch all reviews' });
    }
});
router.get('/admin/pending', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const pendingReviews = await db_1.db
            .select({
            id: schema_1.productReviews.id,
            productId: schema_1.productReviews.productId,
            rating: schema_1.productReviews.rating,
            title: schema_1.productReviews.title,
            comment: schema_1.productReviews.comment,
            status: schema_1.productReviews.status,
            isVerifiedPurchase: schema_1.productReviews.isVerifiedPurchase,
            helpfulCount: schema_1.productReviews.helpfulCount,
            createdAt: schema_1.productReviews.createdAt,
            user: {
                id: schema_1.users.id,
                name: schema_1.users.name,
                email: schema_1.users.email,
            },
            product: {
                id: schema_1.products.id,
                name: schema_1.products.name,
                brand: schema_1.products.brand,
            },
            images: schema_1.reviewImages.imageUrl,
        })
            .from(schema_1.productReviews)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.productReviews.userId, schema_1.users.id))
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.productReviews.productId, schema_1.products.id))
            .leftJoin(schema_1.reviewImages, (0, drizzle_orm_1.eq)(schema_1.productReviews.id, schema_1.reviewImages.reviewId))
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.status, 'pending'))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.productReviews.createdAt))
            .limit(Number(limit))
            .offset(offset);
        const totalCount = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.productReviews)
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.status, 'pending'));
        console.log('🔍 [REVIEWS API] Pending reviews raw data:', pendingReviews);
        res.json({
            reviews: pendingReviews,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount[0].count,
                totalPages: Math.ceil(totalCount[0].count / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('Error fetching pending reviews:', error);
        res.status(500).json({ error: 'Failed to fetch pending reviews' });
    }
});
router.put('/admin/:reviewId/status', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status must be either "approved" or "rejected"' });
        }
        const [updatedReview] = await db_1.db
            .update(schema_1.productReviews)
            .set({
            status,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.productReviews.id, Number(reviewId)))
            .returning();
        res.json({
            message: `Review ${status} successfully`,
            review: updatedReview,
        });
    }
    catch (error) {
        console.error('Error updating review status:', error);
        res.status(500).json({ error: 'Failed to update review status' });
    }
});
exports.default = router;
