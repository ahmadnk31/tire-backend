import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { productReviews, reviewImages, reviewHelpfulVotes, products, users, orders } from '../db/schema';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { eq, and, desc, asc, count, avg, or } from 'drizzle-orm';
import S3Service from '../services/s3Service';
import { upload, handleMulterError } from '../middleware/upload';

const router = express.Router();
const s3Service = new S3Service();

// Test endpoint to verify reviews route is working
router.get('/test', async (req, res) => {
  console.log('🧪 [REVIEWS API] Test endpoint called');
  
  try {
    // Test query to see what's in the database
    const testReviews = await db
      .select({
        id: productReviews.id,
        productId: productReviews.productId,
        status: productReviews.status,
        title: productReviews.title,
      })
      .from(productReviews)
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
  } catch (error) {
    console.error('🧪 [REVIEWS API] Test query error:', error);
    res.status(500).json({ error: 'Test query failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get reviews for a product
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
    
    // Get user ID from token if available
    const token = req.headers.authorization?.replace('Bearer ', '');
    let userId = null;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        userId = decoded.id;
      } catch (error) {
        // Token invalid, continue without user context
      }
    }
    
    // Build where conditions
    // Show approved reviews to everyone, and pending/rejected reviews to the user who created them
    const whereConditions = [eq(productReviews.productId, Number(productId))];
    
    if (userId) {
      // If user is logged in, show their reviews (any status) + approved reviews from others
      const statusCondition = or(
        eq(productReviews.status, 'approved'),
        eq(productReviews.userId, userId)
      );
      if (statusCondition) {
        whereConditions.push(statusCondition);
      }
    } else {
      // If not logged in, only show approved reviews
      whereConditions.push(eq(productReviews.status, 'approved'));
    }
    
    if (rating) {
      whereConditions.push(eq(productReviews.rating, Number(rating)));
    }
    
    // Ensure we always have at least the product ID condition
    const finalWhereConditions = whereConditions.length > 0 ? whereConditions : [eq(productReviews.productId, Number(productId))];
    
    // Build order by
    let orderBy = desc(productReviews.createdAt);
    if (sort === 'oldest') {
      orderBy = asc(productReviews.createdAt);
    } else if (sort === 'rating') {
      orderBy = desc(productReviews.rating);
    } else if (sort === 'helpful') {
      orderBy = desc(productReviews.helpfulCount);
    }
    
    console.log('🗄️ [REVIEWS API] Executing database query with conditions:', whereConditions);
    
    // Get reviews with user info and images
    const reviews = await db
      .select({
        id: productReviews.id,
        rating: productReviews.rating,
        title: productReviews.title,
        comment: productReviews.comment,
        status: productReviews.status,
        isVerifiedPurchase: productReviews.isVerifiedPurchase,
        helpfulCount: productReviews.helpfulCount,
        createdAt: productReviews.createdAt,
        user: {
          id: users.id,
          name: users.name,
        },
        images: reviewImages.imageUrl,
      })
      .from(productReviews)
      .leftJoin(users, eq(productReviews.userId, users.id))
      .leftJoin(reviewImages, eq(productReviews.id, reviewImages.reviewId))
      .where(and(...finalWhereConditions))
      .orderBy(orderBy)
      .limit(Number(limit))
      .offset(offset);
    
    console.log('📊 [REVIEWS API] Database query completed. Raw results count:', reviews.length);
    
    // Get total count
    const totalCount = await db
      .select({ count: count() })
      .from(productReviews)
      .where(and(...finalWhereConditions));
    
    // Get average rating
    const avgRating = await db
      .select({ avg: avg(productReviews.rating) })
      .from(productReviews)
      .where(and(eq(productReviews.productId, Number(productId)), eq(productReviews.status, 'approved')));
    
    // Ensure averageRating is a number
    const averageRating = avgRating[0].avg !== null ? Number(avgRating[0].avg) : 0;

    // Get rating distribution
    const ratingDistribution = await db
      .select({
        rating: productReviews.rating,
        count: count()
      })
      .from(productReviews)
      .where(and(eq(productReviews.productId, Number(productId)), eq(productReviews.status, 'approved')))
      .groupBy(productReviews.rating);

    // Convert to object format { 1: count, 2: count, etc. }
    const ratingDist = ratingDistribution.reduce((acc, item) => {
      acc[item.rating] = Number(item.count);
      return acc;
    }, {} as Record<number, number>);
    
    // Group reviews by review ID and collect images
    const groupedReviews = reviews.reduce((acc, review) => {
      const existingReview = acc.find(r => r.id === review.id);
      if (existingReview) {
        if (review.images) {
          existingReview.images.push(review.images);
        }
      } else {
        acc.push({
          ...review,
          images: review.images ? [review.images] : [],
        });
      }
      return acc;
    }, [] as any[]);
    
    console.log('📈 [REVIEWS API] Statistics calculated:', {
      totalCount: totalCount[0].count,
      averageRating: averageRating,
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
  } catch (error) {
    console.error('❌ [REVIEWS API] Error fetching reviews:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      productId: req.params.productId,
      query: req.query
    });
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Create a new review
router.post('/', requireAuth, async (req: any, res: any) => {
  console.log('🔍 [REVIEWS API] POST / called');
  console.log('📋 [REVIEWS API] Create review request details:', {
    body: req.body,
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    userId: (req as any).user?.id,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    }
  });
  
  try {
    const { productId, orderId, rating, title, comment, images } = req.body;
    const userId = (req as any).user.id;
    
    // Ensure images is an array
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
    
    // Validate required fields
    if (!productId || !rating || rating < 1 || rating > 5) {
      console.log('❌ [REVIEWS API] Validation failed:', { productId, rating });
      return res.status(400).json({ error: 'Product ID and rating (1-5) are required' });
    }
    
    console.log('✅ [REVIEWS API] Validation passed');
    
    // Check if product exists
    const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product.length) {
      console.log('❌ [REVIEWS API] Product not found:', productId);
      return res.status(404).json({ error: 'Product not found' });
    }
    
    console.log('✅ [REVIEWS API] Product found:', product[0].name);
    
    // Check if user has already reviewed this product
    const existingReview = await db
      .select()
      .from(productReviews)
      .where(and(eq(productReviews.productId, productId), eq(productReviews.userId, userId)))
      .limit(1);
    
    if (existingReview.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }
    
    // Check if orderId is provided and belongs to user
    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
        .limit(1);
      
      if (order.length > 0) {
        isVerifiedPurchase = true;
      }
    }
    
    console.log('🗄️ [REVIEWS API] Creating review in database...');
    
    // Create review
    const [newReview] = await db
      .insert(productReviews)
      .values({
        productId: Number(productId),
        userId,
        orderId: orderId ? Number(orderId) : null,
        rating: Number(rating),
        title: title || null,
        comment: comment || null,
        isVerifiedPurchase,
        status: 'pending', // Requires admin approval
      })
      .returning();
    
    console.log('✅ [REVIEWS API] Review created successfully:', {
      reviewId: newReview.id,
      productId: newReview.productId,
      userId: newReview.userId,
      rating: newReview.rating
    });
    
    // Process image URLs if provided
    if (imageUrls && imageUrls.length > 0) {
      console.log('📸 [REVIEWS API] Processing image URLs:', imageUrls.length);
      console.log('📸 [REVIEWS API] Image URLs:', imageUrls);
      
      const imagePromises = imageUrls.map(async (imageUrl: string, index: number) => {
        try {
          console.log(`🖼️ [REVIEWS API] Processing image URL ${index}:`, imageUrl);
          
          // Validate that it's a valid URL
          if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
            console.log(`❌ [REVIEWS API] Invalid image URL for image ${index}:`, imageUrl);
            throw new Error('Invalid image URL format');
          }
          
          console.log(`✅ [REVIEWS API] Image URL ${index} processed successfully:`, imageUrl);
          
          // Save image record
          await db.insert(reviewImages).values({
            reviewId: newReview.id,
            imageUrl: imageUrl,
            altText: `Review image ${index + 1}`,
            sortOrder: index,
          });
        } catch (error) {
          console.error(`❌ [REVIEWS API] Error processing image ${index}:`, error);
          throw error;
        }
      });
      
      await Promise.all(imagePromises);
      console.log('✅ [REVIEWS API] All images processed successfully');
    }
    
    // Get the complete review with images
    const completeReview = await db
      .select({
        id: productReviews.id,
        rating: productReviews.rating,
        title: productReviews.title,
        comment: productReviews.comment,
        isVerifiedPurchase: productReviews.isVerifiedPurchase,
        helpfulCount: productReviews.helpfulCount,
        createdAt: productReviews.createdAt,
        user: {
          id: users.id,
          name: users.name,
        },
        images: reviewImages.imageUrl,
      })
      .from(productReviews)
      .leftJoin(users, eq(productReviews.userId, users.id))
      .leftJoin(reviewImages, eq(productReviews.id, reviewImages.reviewId))
      .where(eq(productReviews.id, newReview.id));
    
    res.status(201).json({
      message: 'Review submitted successfully and pending approval',
      review: completeReview[0],
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Update a review (user can only update their own review)
router.put('/:reviewId', requireAuth, async (req: any, res: any) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment, images } = req.body;
    const userId = (req as any).user.id;
    
    // Ensure images is an array
    const imageUrls = Array.isArray(images) ? images : [];
    
    // Check if review exists and belongs to user
    const existingReview = await db
      .select()
      .from(productReviews)
      .where(and(eq(productReviews.id, Number(reviewId)), eq(productReviews.userId, userId)))
      .limit(1);
    
    if (!existingReview.length) {
      return res.status(404).json({ error: 'Review not found or you do not have permission to edit it' });
    }
    
    // Update review
    const [updatedReview] = await db
      .update(productReviews)
      .set({
        rating: rating ? Number(rating) : existingReview[0].rating,
        title: title || existingReview[0].title,
        comment: comment || existingReview[0].comment,
        status: 'pending', // Reset to pending for admin approval
        updatedAt: new Date(),
      })
      .where(eq(productReviews.id, Number(reviewId)))
      .returning();
    
    // Handle image URLs if provided
    if (imageUrls && imageUrls.length > 0) {
      // Delete existing images
      await db.delete(reviewImages).where(eq(reviewImages.reviewId, Number(reviewId)));
      
      // Save new image URLs
      const imagePromises = imageUrls.map(async (imageUrl: string, index: number) => {
        try {
          // Validate that it's a valid URL
          if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
            console.log(`❌ [REVIEWS API] Invalid image URL for image ${index}:`, imageUrl);
            throw new Error('Invalid image URL format');
          }
          
          await db.insert(reviewImages).values({
            reviewId: Number(reviewId),
            imageUrl: imageUrl,
            altText: `Review image ${index + 1}`,
            sortOrder: index,
          });
        } catch (error) {
          console.error('Error saving review image URL:', error);
        }
      });
      
      await Promise.all(imagePromises);
    }
    
    res.json({
      message: 'Review updated successfully and pending approval',
      review: updatedReview,
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete a review (user can only delete their own review)
router.delete('/:reviewId', requireAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).user.id;
    
    // Check if review exists and belongs to user
    const existingReview = await db
      .select()
      .from(productReviews)
      .where(and(eq(productReviews.id, Number(reviewId)), eq(productReviews.userId, userId)))
      .limit(1);
    
    if (!existingReview.length) {
      return res.status(404).json({ error: 'Review not found or you do not have permission to delete it' });
    }
    
    // Delete review (cascade will delete images)
    await db.delete(productReviews).where(eq(productReviews.id, Number(reviewId)));
    
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Mark review as helpful
router.post('/:reviewId/helpful', requireAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).user.id;
    
    // Check if review exists
    const currentReview = await db
      .select({ helpfulCount: productReviews.helpfulCount })
      .from(productReviews)
      .where(eq(productReviews.id, Number(reviewId)))
      .limit(1);

    if (!currentReview.length) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user has already voted
    const existingVote = await db
      .select()
      .from(reviewHelpfulVotes)
      .where(and(
        eq(reviewHelpfulVotes.reviewId, Number(reviewId)),
        eq(reviewHelpfulVotes.userId, userId)
      ))
      .limit(1);

    if (existingVote.length > 0) {
      return res.status(400).json({ 
        error: 'You have already marked this review as helpful',
        helpfulCount: currentReview[0].helpfulCount || 0
      });
    }

    // Add helpful vote
    await db.insert(reviewHelpfulVotes).values({
      reviewId: Number(reviewId),
      userId: userId,
    });

    // Increment helpful count
    const [updatedReview] = await db
      .update(productReviews)
      .set({
        helpfulCount: (currentReview[0].helpfulCount || 0) + 1,
      })
      .where(eq(productReviews.id, Number(reviewId)))
      .returning();
    
    res.json({ helpfulCount: updatedReview.helpfulCount });
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    res.status(500).json({ error: 'Failed to mark review as helpful' });
  }
});

// Check if user has voted for a review
router.get('/:reviewId/helpful/check', requireAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).user.id;
    
    const existingVote = await db
      .select()
      .from(reviewHelpfulVotes)
      .where(and(
        eq(reviewHelpfulVotes.reviewId, Number(reviewId)),
        eq(reviewHelpfulVotes.userId, userId)
      ))
      .limit(1);

    res.json({ hasVoted: existingVote.length > 0 });
  } catch (error) {
    console.error('Error checking helpful vote:', error);
    res.status(500).json({ error: 'Failed to check helpful vote' });
  }
});

// Remove helpful vote (toggle off)
router.delete('/:reviewId/helpful', requireAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).user.id;
    
    // Check if review exists
    const currentReview = await db
      .select({ helpfulCount: productReviews.helpfulCount })
      .from(productReviews)
      .where(eq(productReviews.id, Number(reviewId)))
      .limit(1);

    if (!currentReview.length) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user has voted
    const existingVote = await db
      .select()
      .from(reviewHelpfulVotes)
      .where(and(
        eq(reviewHelpfulVotes.reviewId, Number(reviewId)),
        eq(reviewHelpfulVotes.userId, userId)
      ))
      .limit(1);

    if (existingVote.length === 0) {
      return res.status(400).json({ 
        error: 'You have not voted for this review',
        helpfulCount: currentReview[0].helpfulCount || 0
      });
    }

    // Remove helpful vote
    await db.delete(reviewHelpfulVotes).where(and(
      eq(reviewHelpfulVotes.reviewId, Number(reviewId)),
      eq(reviewHelpfulVotes.userId, userId)
    ));

    // Decrement helpful count
    const [updatedReview] = await db
      .update(productReviews)
      .set({
        helpfulCount: Math.max(0, (currentReview[0].helpfulCount || 0) - 1),
      })
      .where(eq(productReviews.id, Number(reviewId)))
      .returning();
    
    res.json({ helpfulCount: updatedReview.helpfulCount });
  } catch (error) {
    console.error('Error removing helpful vote:', error);
    res.status(500).json({ error: 'Failed to remove helpful vote' });
  }
});

// Admin routes for managing reviews
router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    // Build where conditions
    const whereConditions = [];
    if (status && status !== 'all') {
      whereConditions.push(eq(productReviews.status, status as string));
    }
    
    const allReviews = await db
      .select({
        id: productReviews.id,
        productId: productReviews.productId,
        rating: productReviews.rating,
        title: productReviews.title,
        comment: productReviews.comment,
        status: productReviews.status,
        isVerifiedPurchase: productReviews.isVerifiedPurchase,
        helpfulCount: productReviews.helpfulCount,
        createdAt: productReviews.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        product: {
          id: products.id,
          name: products.name,
          brand: products.brand,
        },
        images: reviewImages.imageUrl,
      })
      .from(productReviews)
      .leftJoin(users, eq(productReviews.userId, users.id))
      .leftJoin(products, eq(productReviews.productId, products.id))
      .leftJoin(reviewImages, eq(productReviews.id, reviewImages.reviewId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(productReviews.createdAt))
      .limit(Number(limit))
      .offset(offset);
    
    const totalCount = await db
      .select({ count: count() })
      .from(productReviews)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    
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
  } catch (error) {
    console.error('Error fetching all reviews:', error);
    res.status(500).json({ error: 'Failed to fetch all reviews' });
  }
});

router.get('/admin/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    const pendingReviews = await db
      .select({
        id: productReviews.id,
        productId: productReviews.productId,
        rating: productReviews.rating,
        title: productReviews.title,
        comment: productReviews.comment,
        status: productReviews.status,
        isVerifiedPurchase: productReviews.isVerifiedPurchase,
        helpfulCount: productReviews.helpfulCount,
        createdAt: productReviews.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        product: {
          id: products.id,
          name: products.name,
          brand: products.brand,
        },
        images: reviewImages.imageUrl,
      })
      .from(productReviews)
      .leftJoin(users, eq(productReviews.userId, users.id))
      .leftJoin(products, eq(productReviews.productId, products.id))
      .leftJoin(reviewImages, eq(productReviews.id, reviewImages.reviewId))
      .where(eq(productReviews.status, 'pending'))
      .orderBy(desc(productReviews.createdAt))
      .limit(Number(limit))
      .offset(offset);
    
    const totalCount = await db
      .select({ count: count() })
      .from(productReviews)
      .where(eq(productReviews.status, 'pending'));
    
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
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

// Approve or reject review
router.put('/admin/:reviewId/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be either "approved" or "rejected"' });
    }
    
    const [updatedReview] = await db
      .update(productReviews)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(productReviews.id, Number(reviewId)))
      .returning();
    
    res.json({
      message: `Review ${status} successfully`,
      review: updatedReview,
    });
  } catch (error) {
    console.error('Error updating review status:', error);
    res.status(500).json({ error: 'Failed to update review status' });
  }
});

export default router;
