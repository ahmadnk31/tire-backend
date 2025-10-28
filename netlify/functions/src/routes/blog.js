"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const s3Service_1 = __importDefault(require("../services/s3Service"));
const router = express_1.default.Router();
const s3Service = new s3Service_1.default();
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
};
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const category = req.query.category;
        const search = req.query.search;
        const featured = req.query.featured === 'true';
        const offset = (page - 1) * limit;
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.blogPosts.status, 'published')];
        if (category && category !== 'all') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.blogPosts.category, category));
        }
        if (search) {
            whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema_1.blogPosts.title, `%${search}%`), (0, drizzle_orm_1.like)(schema_1.blogPosts.excerpt, `%${search}%`), (0, drizzle_orm_1.like)(schema_1.blogPosts.content, `%${search}%`)));
        }
        if (featured) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.blogPosts.featured, true));
        }
        console.log('🔍 Fetching blog posts with conditions:', {
            status: 'published',
            category,
            search,
            featured,
            page,
            limit,
            offset
        });
        const posts = await db_1.db
            .select()
            .from(schema_1.blogPosts)
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.blogPosts.publishedAt), (0, drizzle_orm_1.desc)(schema_1.blogPosts.createdAt))
            .limit(limit)
            .offset(offset);
        console.log('📝 Found blog posts:', posts.length);
        const totalResult = await db_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_1.blogPosts)
            .where((0, drizzle_orm_1.and)(...whereConditions));
        const total = totalResult[0].count;
        const totalPages = Math.ceil(total / limit);
        console.log('📊 Blog posts stats:', { total, totalPages, currentPage: page });
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
    }
    catch (error) {
        console.error('Error fetching blog posts:', error);
        res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
});
router.get('/featured', async (req, res) => {
    try {
        const posts = await db_1.db
            .select()
            .from(schema_1.blogPosts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.blogPosts.status, 'published'), (0, drizzle_orm_1.eq)(schema_1.blogPosts.featured, true)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.blogPosts.publishedAt))
            .limit(5);
        const postsWithParsedTags = posts.map(post => ({
            ...post,
            tags: post.tags ? JSON.parse(post.tags) : []
        }));
        res.json({ posts: postsWithParsedTags });
    }
    catch (error) {
        console.error('Error fetching featured posts:', error);
        res.status(500).json({ error: 'Failed to fetch featured posts' });
    }
});
router.get('/categories', async (req, res) => {
    try {
        const categories = await db_1.db
            .selectDistinct({ category: schema_1.blogPosts.category })
            .from(schema_1.blogPosts)
            .where((0, drizzle_orm_1.eq)(schema_1.blogPosts.status, 'published'));
        const categoryCounts = await db_1.db
            .select({
            category: schema_1.blogPosts.category,
            count: (0, drizzle_orm_1.sql) `count(*)`
        })
            .from(schema_1.blogPosts)
            .where((0, drizzle_orm_1.eq)(schema_1.blogPosts.status, 'published'))
            .groupBy(schema_1.blogPosts.category);
        const categoryMap = new Map();
        categoryCounts.forEach(item => {
            categoryMap.set(item.category, item.count);
        });
        const categoriesWithCounts = categories.map(cat => ({
            name: cat.category,
            count: categoryMap.get(cat.category) || 0
        }));
        res.json({ categories: categoriesWithCounts });
    }
    catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const post = await db_1.db
            .select()
            .from(schema_1.blogPosts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.blogPosts.slug, slug), (0, drizzle_orm_1.eq)(schema_1.blogPosts.status, 'published')))
            .limit(1);
        if (post.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        const comments = await db_1.db
            .select()
            .from(schema_1.blogComments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.blogComments.postId, post[0].id), (0, drizzle_orm_1.eq)(schema_1.blogComments.status, 'approved')))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.blogComments.createdAt));
        const postWithParsedTags = {
            ...post[0],
            tags: post[0].tags ? JSON.parse(post[0].tags) : [],
            comments
        };
        res.json({ post: postWithParsedTags });
    }
    catch (error) {
        console.error('Error fetching blog post:', error);
        res.status(500).json({ error: 'Failed to fetch blog post' });
    }
});
router.post('/:slug/view', async (req, res) => {
    try {
        const { slug } = req.params;
        const post = await db_1.db
            .select()
            .from(schema_1.blogPosts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.blogPosts.slug, slug), (0, drizzle_orm_1.eq)(schema_1.blogPosts.status, 'published')))
            .limit(1);
        if (post.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        await db_1.db
            .update(schema_1.blogPosts)
            .set({ views: (0, drizzle_orm_1.sql) `${schema_1.blogPosts.views} + 1` })
            .where((0, drizzle_orm_1.eq)(schema_1.blogPosts.id, post[0].id));
        res.json({ success: true, views: (post[0].views || 0) + 1 });
    }
    catch (error) {
        console.error('Error incrementing view count:', error);
        res.status(500).json({ error: 'Failed to increment view count' });
    }
});
router.post('/:postId/comments', async (req, res) => {
    try {
        const { postId } = req.params;
        const { content, authorName, authorEmail } = req.body;
        if (!content || !authorName || !authorEmail) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const newComment = await db_1.db
            .insert(schema_1.blogComments)
            .values({
            postId: parseInt(postId),
            authorName,
            authorEmail,
            content,
            status: 'pending'
        })
            .returning();
        res.status(201).json({ comment: newComment[0] });
    }
    catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});
router.post('/subscribe', async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const existing = await db_1.db
            .select()
            .from(schema_1.blogSubscribers)
            .where((0, drizzle_orm_1.eq)(schema_1.blogSubscribers.email, email))
            .limit(1);
        if (existing.length > 0) {
            if (existing[0].status === 'active') {
                return res.status(400).json({ error: 'Already subscribed' });
            }
            else {
                await db_1.db
                    .update(schema_1.blogSubscribers)
                    .set({
                    status: 'active',
                    name: name || existing[0].name,
                    unsubscribedAt: null
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.blogSubscribers.id, existing[0].id));
                return res.json({ message: 'Subscription reactivated' });
            }
        }
        const newSubscriber = await db_1.db
            .insert(schema_1.blogSubscribers)
            .values({
            email,
            name,
            status: 'active'
        })
            .returning();
        res.status(201).json({ subscriber: newSubscriber[0] });
    }
    catch (error) {
        console.error('Error subscribing:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});
router.post('/unsubscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        await db_1.db
            .update(schema_1.blogSubscribers)
            .set({
            status: 'unsubscribed',
            unsubscribedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.blogSubscribers.email, email));
        res.json({ message: 'Unsubscribed successfully' });
    }
    catch (error) {
        console.error('Error unsubscribing:', error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});
router.get('/admin/posts', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const offset = (page - 1) * limit;
        let whereConditions = [];
        if (status && status !== 'all') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.blogPosts.status, status));
        }
        const posts = await db_1.db
            .select()
            .from(schema_1.blogPosts)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.blogPosts.createdAt))
            .limit(limit)
            .offset(offset);
        const totalResult = await db_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_1.blogPosts)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
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
    }
    catch (error) {
        console.error('Error fetching admin posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});
router.post('/admin/posts', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { title, excerpt, content, category, tags, featured, status, readTime, image } = req.body;
        console.log('📝 Creating blog post:', {
            title,
            category,
            status,
            featured,
            hasContent: !!content,
            hasImage: !!image
        });
        if (!title || !content || !category) {
            console.log('❌ Missing required fields:', { title: !!title, content: !!content, category: !!category });
            return res.status(400).json({ error: 'Missing required fields' });
        }
        let tagsArray = null;
        if (tags) {
            try {
                if (Array.isArray(tags)) {
                    tagsArray = tags;
                }
                else if (typeof tags === 'string') {
                    const trimmed = tags.trim();
                    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                        try {
                            const parsed = JSON.parse(trimmed);
                            if (Array.isArray(parsed)) {
                                tagsArray = parsed;
                            }
                            else {
                                tagsArray = [trimmed];
                            }
                        }
                        catch {
                            tagsArray = [trimmed];
                        }
                    }
                    else {
                        tagsArray = trimmed
                            .split(/[#|,]/)
                            .map((t) => t.trim())
                            .filter(Boolean);
                    }
                }
            }
            catch (err) {
                tagsArray = null;
            }
        }
        const slug = generateSlug(title);
        const newPost = await db_1.db
            .insert(schema_1.blogPosts)
            .values({
            title,
            slug,
            excerpt,
            content,
            author: req.user?.name || 'Admin',
            authorId: req.user?.id,
            category,
            tags: tagsArray ? JSON.stringify(tagsArray) : null,
            featured: featured === 'true',
            status,
            readTime,
            image: image || null,
            publishedAt: status === 'published' ? new Date() : null
        })
            .returning();
        console.log('✅ Blog post created successfully:', {
            id: newPost[0].id,
            title: newPost[0].title,
            status: newPost[0].status,
            slug: newPost[0].slug
        });
        res.status(201).json({ post: newPost[0] });
    }
    catch (error) {
        console.error('❌ Error creating blog post:', error);
        res.status(500).json({ error: 'Failed to create blog post' });
    }
});
router.put('/admin/posts/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, excerpt, content, category, tags, featured, status, readTime, image } = req.body;
        if (!title || !content || !category) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const slug = generateSlug(title);
        let tagsArray = null;
        if (tags) {
            try {
                if (Array.isArray(tags)) {
                    tagsArray = tags;
                }
                else if (typeof tags === 'string') {
                    const trimmed = tags.trim();
                    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                        try {
                            const parsed = JSON.parse(trimmed);
                            if (Array.isArray(parsed)) {
                                tagsArray = parsed;
                            }
                            else {
                                tagsArray = [trimmed];
                            }
                        }
                        catch {
                            tagsArray = [trimmed];
                        }
                    }
                    else {
                        tagsArray = trimmed
                            .split(/[#|,]/)
                            .map((t) => t.trim())
                            .filter(Boolean);
                    }
                }
            }
            catch (err) {
                tagsArray = null;
            }
        }
        const updateData = {
            title,
            slug,
            excerpt,
            content,
            category,
            tags: tagsArray ? JSON.stringify(tagsArray) : null,
            featured: featured === 'true',
            status,
            readTime,
            image: image || null,
            updatedAt: new Date()
        };
        if (status === 'published') {
            updateData.publishedAt = new Date();
        }
        const updatedPost = await db_1.db
            .update(schema_1.blogPosts)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.blogPosts.id, parseInt(id)))
            .returning();
        if (updatedPost.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        res.json({ post: updatedPost[0] });
    }
    catch (error) {
        console.error('Error updating blog post:', error);
        res.status(500).json({ error: 'Failed to update blog post' });
    }
});
router.delete('/admin/posts/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedPost = await db_1.db
            .delete(schema_1.blogPosts)
            .where((0, drizzle_orm_1.eq)(schema_1.blogPosts.id, parseInt(id)))
            .returning();
        if (deletedPost.length === 0) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        res.json({ message: 'Blog post deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting blog post:', error);
        res.status(500).json({ error: 'Failed to delete blog post' });
    }
});
router.get('/admin/comments', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const offset = (page - 1) * limit;
        let whereConditions = [];
        if (status && status !== 'all') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.blogComments.status, status));
        }
        const comments = await db_1.db
            .select({
            id: schema_1.blogComments.id,
            content: schema_1.blogComments.content,
            authorName: schema_1.blogComments.authorName,
            authorEmail: schema_1.blogComments.authorEmail,
            status: schema_1.blogComments.status,
            createdAt: schema_1.blogComments.createdAt,
            postTitle: schema_1.blogPosts.title,
            postSlug: schema_1.blogPosts.slug
        })
            .from(schema_1.blogComments)
            .leftJoin(schema_1.blogPosts, (0, drizzle_orm_1.eq)(schema_1.blogComments.postId, schema_1.blogPosts.id))
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.blogComments.createdAt))
            .limit(limit)
            .offset(offset);
        const totalResult = await db_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_1.blogComments)
            .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined);
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
    }
    catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});
router.put('/admin/comments/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['pending', 'approved', 'spam'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const updatedComment = await db_1.db
            .update(schema_1.blogComments)
            .set({ status, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.blogComments.id, parseInt(id)))
            .returning();
        if (updatedComment.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        res.json({ comment: updatedComment[0] });
    }
    catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});
router.delete('/admin/comments/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedComment = await db_1.db
            .delete(schema_1.blogComments)
            .where((0, drizzle_orm_1.eq)(schema_1.blogComments.id, parseInt(id)))
            .returning();
        if (deletedComment.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        res.json({ message: 'Comment deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});
exports.default = router;
