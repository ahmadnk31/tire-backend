import express from 'express';
import { db } from '../db';
import { blogPosts, blogComments, blogSubscribers } from '../db/schema';
import { eq, desc, asc, like, and, or, sql } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { upload, handleMulterError } from '../middleware/upload';
import S3Service from '../services/s3Service';

const router = express.Router();
const s3Service = new S3Service();

// Helper function to generate slug
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// GET /api/blog - Get all published blog posts with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;
    const search = req.query.search as string;
    const featured = req.query.featured === 'true';
    
    const offset = (page - 1) * limit;
    
    // Build where conditions
    let whereConditions = [eq(blogPosts.status, 'published')];
    
    if (category && category !== 'all') {
      whereConditions.push(eq(blogPosts.category, category));
    }
    
    if (search) {
      whereConditions.push(
        or(
          like(blogPosts.title, `%${search}%`),
          like(blogPosts.excerpt, `%${search}%`),
          like(blogPosts.content, `%${search}%`)
        )!
      );
    }
    
    if (featured) {
      whereConditions.push(eq(blogPosts.featured, true));
    }
    
    // Get posts
    const posts = await db
      .select()
      .from(blogPosts)
      .where(and(...whereConditions))
      .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt))
      .limit(limit)
      .offset(offset);
    
    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(and(...whereConditions));
    
    const total = totalResult[0].count;
    const totalPages = Math.ceil(total / limit);
    
    // Parse tags for each post
    const postsWithParsedTags = posts.map(post => ({
      ...post,
      tags: post.tags ? JSON.parse(post.tags) : []
    }));
    
    res.json({
      posts: postsWithParsedTags,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

// GET /api/blog/featured - Get featured posts
router.get('/featured', async (req, res) => {
  try {
    const posts = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.status, 'published'), eq(blogPosts.featured, true)))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(5);
    
    const postsWithParsedTags = posts.map(post => ({
      ...post,
      tags: post.tags ? JSON.parse(post.tags) : []
    }));
    
    res.json({ posts: postsWithParsedTags });
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    res.status(500).json({ error: 'Failed to fetch featured posts' });
  }
});

// GET /api/blog/categories - Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db
      .selectDistinct({ category: blogPosts.category })
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'));
    
    const categoryCounts = await db
      .select({
        category: blogPosts.category,
        count: sql<number>`count(*)`
      })
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'))
      .groupBy(blogPosts.category);
    
    const categoryMap = new Map();
    categoryCounts.forEach(item => {
      categoryMap.set(item.category, item.count);
    });
    
    const categoriesWithCounts = categories.map(cat => ({
      name: cat.category,
      count: categoryMap.get(cat.category) || 0
    }));
    
    res.json({ categories: categoriesWithCounts });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/blog/:slug - Get single blog post by slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const post = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published')))
      .limit(1);
    
    if (post.length === 0) {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    
    // Increment views
    await db
      .update(blogPosts)
      .set({ views: sql`${blogPosts.views} + 1` })
      .where(eq(blogPosts.id, post[0].id));
    
    // Get comments for this post
    const comments = await db
      .select()
      .from(blogComments)
      .where(and(eq(blogComments.postId, post[0].id), eq(blogComments.status, 'approved')))
      .orderBy(asc(blogComments.createdAt));
    
    const postWithParsedTags = {
      ...post[0],
      tags: post[0].tags ? JSON.parse(post[0].tags) : [],
      comments
    };
    
    res.json({ post: postWithParsedTags });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ error: 'Failed to fetch blog post' });
  }
});

// POST /api/blog/:postId/comments - Add comment to blog post
router.post('/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, authorName, authorEmail } = req.body;
    
    if (!content || !authorName || !authorEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newComment = await db
      .insert(blogComments)
      .values({
        postId: parseInt(postId),
        authorName,
        authorEmail,
        content,
        status: 'pending' // Comments need approval
      })
      .returning();
    
    res.status(201).json({ comment: newComment[0] });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// POST /api/blog/subscribe - Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if already subscribed
    const existing = await db
      .select()
      .from(blogSubscribers)
      .where(eq(blogSubscribers.email, email))
      .limit(1);
    
    if (existing.length > 0) {
      if (existing[0].status === 'active') {
        return res.status(400).json({ error: 'Already subscribed' });
      } else {
        // Reactivate subscription
        await db
          .update(blogSubscribers)
          .set({ 
            status: 'active', 
            name: name || existing[0].name,
            unsubscribedAt: null 
          })
          .where(eq(blogSubscribers.id, existing[0].id));
        
        return res.json({ message: 'Subscription reactivated' });
      }
    }
    
    const newSubscriber = await db
      .insert(blogSubscribers)
      .values({
        email,
        name,
        status: 'active'
      })
      .returning();
    
    res.status(201).json({ subscriber: newSubscriber[0] });
  } catch (error) {
    console.error('Error subscribing:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// POST /api/blog/unsubscribe - Unsubscribe from newsletter
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    await db
      .update(blogSubscribers)
      .set({ 
        status: 'unsubscribed',
        unsubscribedAt: new Date()
      })
      .where(eq(blogSubscribers.email, email));
    
    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// ADMIN ROUTES

// GET /api/blog/admin/posts - Get all posts (admin)
router.get('/admin/posts', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    if (status && status !== 'all') {
      whereConditions.push(eq(blogPosts.status, status));
    }
    
    const posts = await db
      .select()
      .from(blogPosts)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(blogPosts.createdAt))
      .limit(limit)
      .offset(offset);
    
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    
    const total = totalResult[0].count;
    const totalPages = Math.ceil(total / limit);
    
    const postsWithParsedTags = posts.map(post => ({
      ...post,
      tags: post.tags ? JSON.parse(post.tags) : []
    }));
    
    res.json({
      posts: postsWithParsedTags,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching admin posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST /api/blog/admin/posts - Create new blog post (admin)
router.post('/admin/posts', requireAuth, requireAdmin, upload.single('image'), handleMulterError, async (req: any, res: any) => {
  try {
    const {
      title,
      excerpt,
      content,
      category,
      tags,
      featured,
      status,
      readTime
    } = req.body;
    
    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const slug = generateSlug(title);
    
    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      try {
        const uploadResult = await s3Service.uploadFile({
          file: req.file.buffer,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          folder: 'blog'
        });
        imageUrl = uploadResult;
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image' });
      }
    }
    
    const newPost = await db
      .insert(blogPosts)
      .values({
        title,
        slug,
        excerpt,
        content,
        author: req.user?.name || 'Admin',
        authorId: req.user?.id,
        category,
        tags: tags ? JSON.stringify(JSON.parse(tags)) : null,
        featured: featured === 'true',
        status,
        readTime,
        image: imageUrl,
        publishedAt: status === 'published' ? new Date() : null
      })
      .returning();
    
    res.status(201).json({ post: newPost[0] });
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({ error: 'Failed to create blog post' });
  }
});

// PUT /api/blog/admin/posts/:id - Update blog post (admin)
router.put('/admin/posts/:id', requireAuth, requireAdmin, upload.single('image'), handleMulterError, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const {
      title,
      excerpt,
      content,
      category,
      tags,
      featured,
      status,
      readTime
    } = req.body;
    
    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const slug = generateSlug(title);
    
    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      try {
        const uploadResult = await s3Service.uploadFile({
          file: req.file.buffer,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          folder: 'blog'
        });
        imageUrl = uploadResult;
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image' });
      }
    }
    
    const updateData: any = {
      title,
      slug,
      excerpt,
      content,
      category,
      tags: tags ? JSON.stringify(JSON.parse(tags)) : null,
      featured: featured === 'true',
      status,
      readTime,
      updatedAt: new Date()
    };
    
    if (imageUrl) {
      updateData.image = imageUrl;
    }
    
    if (status === 'published') {
      updateData.publishedAt = new Date();
    }
    
    const updatedPost = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, parseInt(id)))
      .returning();
    
    if (updatedPost.length === 0) {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    
    res.json({ post: updatedPost[0] });
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

// DELETE /api/blog/admin/posts/:id - Delete blog post (admin)
router.delete('/admin/posts/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedPost = await db
      .delete(blogPosts)
      .where(eq(blogPosts.id, parseInt(id)))
      .returning();
    
    if (deletedPost.length === 0) {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    
    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

// GET /api/blog/admin/comments - Get all comments (admin)
router.get('/admin/comments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    if (status && status !== 'all') {
      whereConditions.push(eq(blogComments.status, status));
    }
    
    const comments = await db
      .select({
        id: blogComments.id,
        content: blogComments.content,
        authorName: blogComments.authorName,
        authorEmail: blogComments.authorEmail,
        status: blogComments.status,
        createdAt: blogComments.createdAt,
        postTitle: blogPosts.title,
        postSlug: blogPosts.slug
      })
      .from(blogComments)
      .leftJoin(blogPosts, eq(blogComments.postId, blogPosts.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(blogComments.createdAt))
      .limit(limit)
      .offset(offset);
    
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(blogComments)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    
    const total = totalResult[0].count;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// PUT /api/blog/admin/comments/:id - Update comment status (admin)
router.put('/admin/comments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'approved', 'spam'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const updatedComment = await db
      .update(blogComments)
      .set({ status, updatedAt: new Date() })
      .where(eq(blogComments.id, parseInt(id)))
      .returning();
    
    if (updatedComment.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    res.json({ comment: updatedComment[0] });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// DELETE /api/blog/admin/comments/:id - Delete comment (admin)
router.delete('/admin/comments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedComment = await db
      .delete(blogComments)
      .where(eq(blogComments.id, parseInt(id)))
      .returning();
    
    if (deletedComment.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
