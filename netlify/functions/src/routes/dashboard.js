"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const emailService_1 = require("../services/emailService");
const router = (0, express_1.Router)();
router.get('/recent-orders', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const recentOrders = await db_1.db.select().from(schema_1.orders).orderBy((0, drizzle_orm_1.desc)(schema_1.orders.createdAt)).limit(10);
        console.log('🔍 [Dashboard] Found recent orders:', recentOrders.length);
        const orderIds = recentOrders.map(o => o.id);
        let itemsByOrderId = {};
        if (orderIds.length > 0) {
            const items = await db_1.db.select().from(schema_1.orderItems).where((0, drizzle_orm_1.inArray)(schema_1.orderItems.orderId, orderIds));
            console.log('🔍 [Dashboard] Found order items:', items.length);
            itemsByOrderId = items.reduce((acc, item) => {
                if (!acc[item.orderId])
                    acc[item.orderId] = [];
                acc[item.orderId].push(item);
                return acc;
            }, {});
        }
        const result = await Promise.all(recentOrders.map(async (order) => {
            const firstItem = (itemsByOrderId[order.id] && itemsByOrderId[order.id][0]) || null;
            let productName = '';
            if (firstItem) {
                const prod = await db_1.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, firstItem.productId));
                productName = prod[0]?.name || '';
            }
            return {
                id: order.orderNumber,
                customer: order.userName,
                product: productName,
                status: order.status,
                amount: `$${order.total}`,
                date: order.createdAt?.toISOString().slice(0, 10) || '',
            };
        }));
        console.log('🔍 [Dashboard] Returning recent orders result:', result);
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching recent orders:', error);
        res.status(500).json({ error: 'Failed to fetch recent orders' });
    }
});
router.get('/', auth_1.requireAuth, auth_1.requireAdmin, (req, res) => {
    res.json({ message: 'Admin dashboard root.' });
});
router.get('/overview', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const usersCount = await db_1.db.select().from(schema_1.users);
        const ordersCount = await db_1.db.select().from(schema_1.orders);
        const productsCount = await db_1.db.select().from(schema_1.products);
        const contactCount = await db_1.db.select().from(schema_1.contactMessages);
        const newsletterCount = await db_1.db.select().from(schema_1.newsletterSubscriptions);
        const activeNewsletterCount = await db_1.db.select().from(schema_1.newsletterSubscriptions)
            .where((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.status, 'active'));
        const revenueResult = await db_1.db.select().from(schema_1.orders);
        const totalRevenue = revenueResult.reduce((sum, o) => sum + parseFloat(o.total), 0);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newUsers = usersCount.filter(u => u.createdAt && u.createdAt > sevenDaysAgo).length;
        const newOrders = ordersCount.filter(o => o.createdAt && o.createdAt > sevenDaysAgo).length;
        const newRevenue = ordersCount.filter(o => o.createdAt && o.createdAt > sevenDaysAgo).reduce((sum, o) => sum + parseFloat(o.total), 0);
        const newContacts = contactCount.filter(c => c.createdAt && c.createdAt > sevenDaysAgo).length;
        const newSubscriptions = newsletterCount.filter(n => n.subscribedAt && n.subscribedAt > sevenDaysAgo).length;
        const pendingContacts = contactCount.filter(c => c.status === 'pending').length;
        const contactsByType = contactCount.reduce((acc, contact) => {
            acc[contact.inquiryType] = (acc[contact.inquiryType] || 0) + 1;
            return acc;
        }, {});
        const orderItemRows = await db_1.db.select().from(schema_1.orderItems);
        const productSales = {};
        orderItemRows.forEach(item => {
            if (item.productId == null)
                return;
            if (!productSales[item.productId])
                productSales[item.productId] = 0;
            productSales[item.productId] += item.quantity;
        });
        const bestSellingIds = Object.entries(productSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, sold]) => ({ id: Number(id), sold }));
        let bestSellingProducts = [];
        if (bestSellingIds.length > 0) {
            const prods = await db_1.db.select().from(schema_1.products).where((0, drizzle_orm_1.inArray)(schema_1.products.id, bestSellingIds.map(p => p.id)));
            bestSellingProducts = bestSellingIds.map(({ id, sold }) => {
                const prod = prods.find((p) => p.id === id);
                return prod ? { id, name: prod.name, sold } : null;
            }).filter(Boolean);
        }
        res.json({
            totalUsers: usersCount.length,
            totalOrders: ordersCount.length,
            totalProducts: productsCount.length,
            totalRevenue,
            totalContacts: contactCount.length,
            totalSubscriptions: newsletterCount.length,
            activeSubscriptions: activeNewsletterCount.length,
            newUsers,
            newOrders,
            newRevenue,
            newContacts,
            newSubscriptions,
            pendingContacts,
            contactsByType,
            bestSellingProducts
        });
    }
    catch (error) {
        console.error('Error fetching dashboard overview:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard overview' });
    }
});
router.get('/contacts', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const inquiryType = req.query.inquiryType;
        const offset = (page - 1) * limit;
        let whereConditions = [];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.contactMessages.status, status));
        }
        if (inquiryType) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.contactMessages.inquiryType, inquiryType));
        }
        const totalQuery = whereConditions.length > 0
            ? db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.contactMessages).where((0, drizzle_orm_1.and)(...whereConditions))
            : db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.contactMessages);
        const [{ count: total }] = await totalQuery;
        const messagesQuery = whereConditions.length > 0
            ? db_1.db.select().from(schema_1.contactMessages).where((0, drizzle_orm_1.and)(...whereConditions)).orderBy((0, drizzle_orm_1.desc)(schema_1.contactMessages.createdAt)).limit(limit).offset(offset)
            : db_1.db.select().from(schema_1.contactMessages).orderBy((0, drizzle_orm_1.desc)(schema_1.contactMessages.createdAt)).limit(limit).offset(offset);
        const messages = await messagesQuery;
        res.json({
            success: true,
            data: {
                messages,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    }
    catch (error) {
        console.error('Error fetching contact messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact messages'
        });
    }
});
router.put('/contacts/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { status, response, adminNotes } = req.body;
        const validStatuses = ['pending', 'in-progress', 'resolved', 'closed'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }
        const [updatedMessage] = await db_1.db.update(schema_1.contactMessages)
            .set({
            status: status || undefined,
            adminResponse: response || undefined,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.contactMessages.id, messageId))
            .returning();
        if (!updatedMessage) {
            return res.status(404).json({
                success: false,
                message: 'Contact message not found'
            });
        }
        res.json({
            success: true,
            message: 'Contact message updated successfully',
            data: updatedMessage
        });
    }
    catch (error) {
        console.error('Error updating contact message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contact message'
        });
    }
});
router.post('/contacts/:id/reply', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { subject, message, markAsResolved = true } = req.body;
        const replySchema = zod_1.z.object({
            subject: zod_1.z.string().min(1, 'Subject is required'),
            message: zod_1.z.string().min(10, 'Message must be at least 10 characters')
        });
        const validatedData = replySchema.parse({ subject, message });
        const [contactMessage] = await db_1.db.select().from(schema_1.contactMessages)
            .where((0, drizzle_orm_1.eq)(schema_1.contactMessages.id, messageId));
        if (!contactMessage) {
            return res.status(404).json({
                success: false,
                message: 'Contact message not found'
            });
        }
        try {
            await (0, emailService_1.sendAdminReplyEmail)(contactMessage.email, contactMessage.name, contactMessage.subject, contactMessage.message, contactMessage.createdAt?.toLocaleDateString() || new Date().toLocaleDateString(), validatedData.subject, validatedData.message);
            console.log('✅ Admin reply email sent to:', contactMessage.email);
        }
        catch (emailError) {
            console.error('⚠️ Failed to send admin reply email:', emailError);
            throw new Error('Failed to send email reply');
        }
        const updateData = {
            adminResponse: validatedData.message,
            updatedAt: new Date()
        };
        if (markAsResolved) {
            updateData.status = 'resolved';
        }
        const [updatedMessage] = await db_1.db.update(schema_1.contactMessages)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.contactMessages.id, messageId))
            .returning();
        res.json({
            success: true,
            message: 'Reply sent successfully',
            data: updatedMessage
        });
    }
    catch (error) {
        console.error('Error sending reply:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: error.issues
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to send reply'
        });
    }
});
router.delete('/contacts/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const [deletedMessage] = await db_1.db.delete(schema_1.contactMessages)
            .where((0, drizzle_orm_1.eq)(schema_1.contactMessages.id, messageId))
            .returning();
        if (!deletedMessage) {
            return res.status(404).json({
                success: false,
                message: 'Contact message not found'
            });
        }
        res.json({
            success: true,
            message: 'Contact message deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting contact message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete contact message'
        });
    }
});
router.get('/subscriptions', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const source = req.query.source;
        const offset = (page - 1) * limit;
        let whereConditions = [];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.status, status));
        }
        if (source) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.source, source));
        }
        const totalQuery = whereConditions.length > 0
            ? db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.newsletterSubscriptions).where((0, drizzle_orm_1.and)(...whereConditions))
            : db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.newsletterSubscriptions);
        const [{ count: total }] = await totalQuery;
        const subscriptionsQuery = whereConditions.length > 0
            ? db_1.db.select().from(schema_1.newsletterSubscriptions).where((0, drizzle_orm_1.and)(...whereConditions)).orderBy((0, drizzle_orm_1.desc)(schema_1.newsletterSubscriptions.subscribedAt)).limit(limit).offset(offset)
            : db_1.db.select().from(schema_1.newsletterSubscriptions).orderBy((0, drizzle_orm_1.desc)(schema_1.newsletterSubscriptions.subscribedAt)).limit(limit).offset(offset);
        const subscriptions = await subscriptionsQuery;
        res.json({
            success: true,
            data: {
                subscriptions,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    }
    catch (error) {
        console.error('Error fetching newsletter subscriptions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch newsletter subscriptions'
        });
    }
});
router.put('/subscriptions/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const subscriptionId = parseInt(req.params.id);
        const { status, tags, metadata } = req.body;
        const validStatuses = ['active', 'unsubscribed', 'bounced'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }
        const updateData = {};
        if (status) {
            updateData.status = status;
            if (status === 'unsubscribed') {
                updateData.unsubscribedAt = new Date();
            }
            else if (status === 'active') {
                updateData.unsubscribedAt = null;
            }
        }
        if (tags)
            updateData.tags = tags;
        if (metadata)
            updateData.metadata = metadata;
        const [updatedSubscription] = await db_1.db.update(schema_1.newsletterSubscriptions)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.id, subscriptionId))
            .returning();
        if (!updatedSubscription) {
            return res.status(404).json({
                success: false,
                message: 'Newsletter subscription not found'
            });
        }
        res.json({
            success: true,
            message: 'Newsletter subscription updated successfully',
            data: updatedSubscription
        });
    }
    catch (error) {
        console.error('Error updating newsletter subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update newsletter subscription'
        });
    }
});
router.post('/subscriptions/send-email', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { subject, message, recipients, tags } = req.body;
        const emailSchema = zod_1.z.object({
            subject: zod_1.z.string().min(1, 'Subject is required'),
            message: zod_1.z.string().min(10, 'Message must be at least 10 characters'),
            recipients: zod_1.z.enum(['all', 'active', 'specific']).default('active'),
            tags: zod_1.z.array(zod_1.z.string()).optional()
        });
        const validatedData = emailSchema.parse({ subject, message, recipients, tags });
        let whereConditions = [];
        if (validatedData.recipients === 'active') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.status, 'active'));
        }
        else if (validatedData.recipients === 'specific' && validatedData.tags) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.status, 'active'));
        }
        const subscribersQuery = whereConditions.length > 0
            ? db_1.db.select().from(schema_1.newsletterSubscriptions).where((0, drizzle_orm_1.and)(...whereConditions))
            : db_1.db.select().from(schema_1.newsletterSubscriptions);
        const subscribers = await subscribersQuery;
        if (subscribers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No subscribers found for the selected criteria'
            });
        }
        let successCount = 0;
        let failureCount = 0;
        const batchSize = 10;
        for (let i = 0; i < subscribers.length; i += batchSize) {
            const batch = subscribers.slice(i, i + batchSize);
            const emailPromises = batch.map(async (subscriber) => {
                try {
                    const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
                    await (0, emailService_1.sendNewsletterCampaignEmail)(subscriber.email, validatedData.subject, validatedData.message, unsubscribeUrl);
                    await db_1.db.update(schema_1.newsletterSubscriptions)
                        .set({ lastEmailSent: new Date() })
                        .where((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.id, subscriber.id));
                    successCount++;
                    console.log(`✅ Newsletter email sent to: ${subscriber.email}`);
                }
                catch (error) {
                    console.error(`⚠️ Failed to send email to ${subscriber.email}:`, error);
                    failureCount++;
                }
            });
            await Promise.all(emailPromises);
            if (i + batchSize < subscribers.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        res.json({
            success: true,
            message: `Email campaign sent successfully`,
            data: {
                totalRecipients: subscribers.length,
                successCount,
                failureCount,
                subject: validatedData.subject
            }
        });
    }
    catch (error) {
        console.error('Error sending newsletter email:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: error.issues
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to send newsletter email'
        });
    }
});
router.post('/contacts/:id/resend-confirmation', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const [contactMessage] = await db_1.db.select().from(schema_1.contactMessages)
            .where((0, drizzle_orm_1.eq)(schema_1.contactMessages.id, messageId));
        if (!contactMessage) {
            return res.status(404).json({
                success: false,
                message: 'Contact message not found'
            });
        }
        try {
            await (0, emailService_1.sendContactConfirmationEmail)(contactMessage.email, contactMessage.name, contactMessage.inquiryType, contactMessage.subject);
            console.log('✅ Contact confirmation email resent to:', contactMessage.email);
        }
        catch (emailError) {
            console.error('⚠️ Failed to resend confirmation email:', emailError);
            throw new Error('Failed to resend confirmation email');
        }
        res.json({
            success: true,
            message: 'Contact confirmation email resent successfully',
            data: {
                emailSent: true,
                recipient: contactMessage.email,
                subject: contactMessage.subject
            }
        });
    }
    catch (error) {
        console.error('Error resending contact confirmation:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to resend confirmation email'
        });
    }
});
router.post('/contacts/:id/notify-admin', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { adminEmail } = req.body;
        if (!adminEmail) {
            return res.status(400).json({
                success: false,
                message: 'Admin email is required'
            });
        }
        const [contactMessage] = await db_1.db.select().from(schema_1.contactMessages)
            .where((0, drizzle_orm_1.eq)(schema_1.contactMessages.id, messageId));
        if (!contactMessage) {
            return res.status(404).json({
                success: false,
                message: 'Contact message not found'
            });
        }
        try {
            await (0, emailService_1.sendAdminNotificationEmail)(adminEmail, contactMessage.name, contactMessage.email, contactMessage.inquiryType, contactMessage.subject, contactMessage.message, contactMessage.phone || undefined);
            console.log('✅ Admin notification email sent to:', adminEmail);
        }
        catch (emailError) {
            console.error('⚠️ Failed to send admin notification:', emailError);
            throw new Error('Failed to send admin notification');
        }
        res.json({
            success: true,
            message: 'Admin notification sent successfully',
            data: {
                emailSent: true,
                recipient: adminEmail,
                contactId: messageId
            }
        });
    }
    catch (error) {
        console.error('Error sending admin notification:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to send admin notification'
        });
    }
});
router.post('/subscriptions/:id/resend-welcome', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const subscriptionId = parseInt(req.params.id);
        const [subscription] = await db_1.db.select().from(schema_1.newsletterSubscriptions)
            .where((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.id, subscriptionId));
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Newsletter subscription not found'
            });
        }
        try {
            await (0, emailService_1.sendNewsletterWelcomeEmail)(subscription.email);
            console.log('✅ Newsletter welcome email resent to:', subscription.email);
        }
        catch (emailError) {
            console.error('⚠️ Failed to resend welcome email:', emailError);
            throw new Error('Failed to resend welcome email');
        }
        res.json({
            success: true,
            message: 'Newsletter welcome email resent successfully',
            data: {
                emailSent: true,
                recipient: subscription.email
            }
        });
    }
    catch (error) {
        console.error('Error resending newsletter welcome:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to resend welcome email'
        });
    }
});
router.post('/users/:id/resend-password-reset', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const [user] = await db_1.db.select().from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        await db_1.db.update(schema_1.users)
            .set({
            resetToken: resetToken
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        try {
            await (0, emailService_1.sendPasswordResetEmail)(user.email, resetToken);
            console.log('✅ Password reset email sent to:', user.email);
        }
        catch (emailError) {
            console.error('⚠️ Failed to send password reset email:', emailError);
            throw new Error('Failed to send password reset email');
        }
        res.json({
            success: true,
            message: 'Password reset email sent successfully',
            data: {
                emailSent: true,
                recipient: user.email,
                userId: userId
            }
        });
    }
    catch (error) {
        console.error('Error sending password reset email:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to send password reset email'
        });
    }
});
router.post('/orders/:id/resend-confirmation', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const [order] = await db_1.db.select({
            id: schema_1.orders.id,
            orderNumber: schema_1.orders.orderNumber,
            total: schema_1.orders.total,
            status: schema_1.orders.status,
            userEmail: schema_1.orders.userEmail,
            userName: schema_1.orders.userName
        })
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        const orderItemsData = await db_1.db.select({
            productName: schema_1.orderItems.productName,
            quantity: schema_1.orderItems.quantity,
            unitPrice: schema_1.orderItems.unitPrice
        })
            .from(schema_1.orderItems)
            .where((0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, orderId));
        try {
            await (0, emailService_1.sendOrderConfirmationEmail)(order.userEmail, order.userName, order.orderNumber, orderItemsData.map(item => ({
                name: item.productName,
                quantity: item.quantity,
                price: parseFloat(item.unitPrice.toString())
            })), parseFloat(order.total.toString()));
            console.log('✅ Order confirmation email resent to:', order.userEmail);
        }
        catch (emailError) {
            console.error('⚠️ Failed to resend order confirmation email:', emailError);
            throw new Error('Failed to resend order confirmation email');
        }
        res.json({
            success: true,
            message: 'Order confirmation email resent successfully',
            data: {
                emailSent: true,
                recipient: order.userEmail,
                orderNumber: order.orderNumber,
                orderId: orderId
            }
        });
    }
    catch (error) {
        console.error('Error resending order confirmation:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to resend order confirmation email'
        });
    }
});
router.delete('/subscriptions/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const subscriptionId = parseInt(req.params.id);
        const [deletedSubscription] = await db_1.db.delete(schema_1.newsletterSubscriptions)
            .where((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.id, subscriptionId))
            .returning();
        if (!deletedSubscription) {
            return res.status(404).json({
                success: false,
                message: 'Newsletter subscription not found'
            });
        }
        res.json({
            success: true,
            message: 'Newsletter subscription deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting newsletter subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete newsletter subscription'
        });
    }
});
router.get('/low-stock', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const lowStockProducts = await db_1.db.select().from(schema_1.products);
        const lowStock = lowStockProducts.filter(p => p.stock <= (p.lowStockThreshold || 10));
        res.json({
            products: lowStock.map(p => ({
                id: p.id,
                name: p.name,
                stock: p.stock,
                threshold: p.lowStockThreshold || 10,
                severity: p.stock <= 2 ? 'critical' : 'low',
            }))
        });
    }
    catch (error) {
        console.error('Error fetching low stock products:', error);
        res.status(500).json({ error: 'Failed to fetch low stock products' });
    }
});
router.get('/campaigns', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const type = req.query.type;
        const offset = (page - 1) * limit;
        let whereConditions = [];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.newsletterCampaigns.status, status));
        }
        if (type) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.newsletterCampaigns.type, type));
        }
        const totalQuery = whereConditions.length > 0
            ? db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.newsletterCampaigns).where((0, drizzle_orm_1.and)(...whereConditions))
            : db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.newsletterCampaigns);
        const [{ count: total }] = await totalQuery;
        const campaignsQuery = whereConditions.length > 0
            ? db_1.db.select().from(schema_1.newsletterCampaigns).where((0, drizzle_orm_1.and)(...whereConditions)).orderBy((0, drizzle_orm_1.desc)(schema_1.newsletterCampaigns.createdAt)).limit(limit).offset(offset)
            : db_1.db.select().from(schema_1.newsletterCampaigns).orderBy((0, drizzle_orm_1.desc)(schema_1.newsletterCampaigns.createdAt)).limit(limit).offset(offset);
        const campaigns = await campaignsQuery;
        res.json({
            success: true,
            data: campaigns,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
    }
});
const createCampaignSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    subject: zod_1.z.string().min(1, 'Subject is required'),
    content: zod_1.z.string().min(1, 'Content is required'),
    type: zod_1.z.enum(['general', 'product_catalog', 'promotional']).default('general'),
    productIds: zod_1.z.array(zod_1.z.number()).optional(),
    scheduledAt: zod_1.z.string().optional(),
});
router.post('/campaigns', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const validatedData = createCampaignSchema.parse(req.body);
        const userId = req.user.id;
        const [campaign] = await db_1.db.insert(schema_1.newsletterCampaigns).values({
            title: validatedData.title,
            subject: validatedData.subject,
            content: validatedData.content,
            type: validatedData.type,
            scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
            createdBy: userId,
        }).returning();
        if (validatedData.type === 'product_catalog' && validatedData.productIds?.length) {
            console.log('📦 Creating product catalog campaign with products:', validatedData.productIds);
            const productInserts = validatedData.productIds.map((productId, index) => ({
                campaignId: campaign.id,
                productId,
                displayOrder: index,
            }));
            await db_1.db.insert(schema_1.newsletterCampaignProducts).values(productInserts);
            console.log('✅ Inserted campaign products:', productInserts.length);
        }
        else {
            console.log('⚠️ No products provided for campaign type:', validatedData.type);
            console.log('⚠️ Product IDs:', validatedData.productIds);
        }
        res.json({
            success: true,
            data: campaign,
            message: 'Campaign created successfully'
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: error.issues.map((e) => ({ field: e.path.join('.'), message: e.message }))
            });
        }
        console.error('Error creating campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to create campaign' });
    }
});
router.get('/campaigns/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        const [campaign] = await db_1.db.select().from(schema_1.newsletterCampaigns).where((0, drizzle_orm_1.eq)(schema_1.newsletterCampaigns.id, campaignId));
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        let products = [];
        if (campaign.type === 'product_catalog') {
            const campaignProducts = await db_1.db
                .select({
                productId: schema_1.newsletterCampaignProducts.productId,
                displayOrder: schema_1.newsletterCampaignProducts.displayOrder,
                product: schema_1.products,
            })
                .from(schema_1.newsletterCampaignProducts)
                .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.newsletterCampaignProducts.productId, schema_1.products.id))
                .where((0, drizzle_orm_1.eq)(schema_1.newsletterCampaignProducts.campaignId, campaignId))
                .orderBy((0, drizzle_orm_1.asc)(schema_1.newsletterCampaignProducts.displayOrder));
            products = campaignProducts.map(cp => cp.product);
        }
        res.json({
            success: true,
            data: {
                ...campaign,
                products
            }
        });
    }
    catch (error) {
        console.error('Error fetching campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaign' });
    }
});
router.post('/campaigns/:id/send', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        const { subscriberFilter } = req.body;
        const [campaign] = await db_1.db.select().from(schema_1.newsletterCampaigns).where((0, drizzle_orm_1.eq)(schema_1.newsletterCampaigns.id, campaignId));
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        if (campaign.status === 'sent') {
            return res.status(400).json({ success: false, error: 'Campaign already sent' });
        }
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.status, 'active')];
        if (subscriberFilter && subscriberFilter !== 'all') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.newsletterSubscriptions.source, subscriberFilter));
        }
        const subscribers = await db_1.db.select().from(schema_1.newsletterSubscriptions).where((0, drizzle_orm_1.and)(...whereConditions));
        if (subscribers.length === 0) {
            return res.status(400).json({ success: false, error: 'No active subscribers found' });
        }
        let emailContent = campaign.content;
        let emailSubject = campaign.subject;
        if (campaign.type === 'product_catalog') {
            console.log('🛍️ Processing product catalog campaign:', campaignId);
            const campaignProducts = await db_1.db
                .select({
                productId: schema_1.newsletterCampaignProducts.productId,
                displayOrder: schema_1.newsletterCampaignProducts.displayOrder,
                productData: {
                    id: schema_1.products.id,
                    name: schema_1.products.name,
                    brand: schema_1.products.brand,
                    model: schema_1.products.model,
                    size: schema_1.products.size,
                    price: schema_1.products.price,
                    comparePrice: schema_1.products.comparePrice,
                    rating: schema_1.products.rating,
                    stock: schema_1.products.stock,
                    description: schema_1.products.description,
                }
            })
                .from(schema_1.newsletterCampaignProducts)
                .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.newsletterCampaignProducts.productId, schema_1.products.id))
                .where((0, drizzle_orm_1.eq)(schema_1.newsletterCampaignProducts.campaignId, campaignId))
                .orderBy((0, drizzle_orm_1.asc)(schema_1.newsletterCampaignProducts.displayOrder));
            console.log('📦 Found campaign products:', campaignProducts.length);
            console.log('📦 Campaign products details:', campaignProducts.map(cp => ({
                productId: cp.productId,
                displayOrder: cp.displayOrder,
                productData: cp.productData ? { id: cp.productData.id, name: cp.productData.name } : null
            })));
            if (campaignProducts.length > 0) {
                const productIds = campaignProducts.map(cp => cp.productId).filter(id => id !== null);
                console.log('🔍 Checking if products exist in products table for IDs:', productIds);
                const existingProducts = await db_1.db
                    .select({ id: schema_1.products.id, name: schema_1.products.name })
                    .from(schema_1.products)
                    .where((0, drizzle_orm_1.inArray)(schema_1.products.id, productIds));
                console.log('✅ Found existing products:', existingProducts);
                console.log('🔍 Product ID types in campaign:', productIds.map(id => typeof id));
                console.log('🔍 Product ID types in products table:', existingProducts.map(p => typeof p.id));
                console.log('🧪 Testing direct JOIN query...');
                const testJoin = await db_1.db
                    .select({
                    campaignProductId: schema_1.newsletterCampaignProducts.productId,
                    productId: schema_1.products.id,
                    productName: schema_1.products.name,
                })
                    .from(schema_1.newsletterCampaignProducts)
                    .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.newsletterCampaignProducts.productId, schema_1.products.id))
                    .where((0, drizzle_orm_1.eq)(schema_1.newsletterCampaignProducts.campaignId, campaignId));
                console.log('🧪 Direct JOIN test results:', testJoin);
            }
            const productIds = campaignProducts
                .map(cp => cp.productId)
                .filter((id) => id !== null && id !== undefined);
            console.log('🔍 Product IDs to fetch images for:', productIds);
            const productImages = productIds.length > 0 ? await db_1.db
                .select()
                .from(schema_1.productImages)
                .where((0, drizzle_orm_1.inArray)(schema_1.productImages.productId, productIds))
                .orderBy((0, drizzle_orm_1.asc)(schema_1.productImages.sortOrder)) : [];
            console.log('🖼️ Found product images:', productImages.length);
            const imagesByProductId = productImages.reduce((acc, img) => {
                if (img.productId !== null) {
                    if (!acc[img.productId])
                        acc[img.productId] = [];
                    acc[img.productId].push(img.imageUrl);
                }
                return acc;
            }, {});
            console.log('📸 Images grouped by product ID:', imagesByProductId);
            const products = campaignProducts
                .filter(cp => cp.productData !== null && cp.productData.id !== null)
                .map(cp => ({
                id: cp.productData.id,
                name: cp.productData.name,
                brand: cp.productData.brand,
                model: cp.productData.model,
                size: cp.productData.size,
                price: cp.productData.price,
                comparePrice: cp.productData.comparePrice || undefined,
                images: imagesByProductId[cp.productData.id] || [],
                rating: cp.productData.rating || undefined,
                stock: cp.productData.stock,
                description: cp.productData.description || undefined,
            }));
            console.log('✅ Final products for email template:', products.length);
            console.log('✅ Products details:', products);
            const websiteUrl = process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app';
            emailContent = (0, emailService_1.getProductCatalogTemplate)({
                products,
                campaignTitle: campaign.title,
                websiteUrl
            });
            console.log('📧 Generated email content length:', emailContent.length);
            console.log('📧 Email content preview:', emailContent.substring(0, 500) + '...');
        }
        const emailPromises = subscribers.map(async (subscriber) => {
            const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app'}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
            if (campaign.type === 'product_catalog') {
                await (0, emailService_1.sendNewsletterCampaignEmail)(subscriber.email, emailSubject, emailContent, unsubscribeUrl);
            }
            else {
                await (0, emailService_1.sendNewsletterCampaignEmail)(subscriber.email, emailSubject, emailContent, unsubscribeUrl);
            }
        });
        await Promise.all(emailPromises);
        await db_1.db.update(schema_1.newsletterCampaigns)
            .set({
            status: 'sent',
            sentAt: new Date(),
            recipientCount: subscribers.length,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.newsletterCampaigns.id, campaignId));
        res.json({
            success: true,
            message: `Campaign sent to ${subscribers.length} subscribers`,
            data: {
                recipientCount: subscribers.length,
                sentAt: new Date(),
            }
        });
    }
    catch (error) {
        console.error('Error sending campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to send campaign' });
    }
});
router.delete('/campaigns/:id', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        await db_1.db.delete(schema_1.newsletterCampaignProducts).where((0, drizzle_orm_1.eq)(schema_1.newsletterCampaignProducts.campaignId, campaignId));
        await db_1.db.delete(schema_1.newsletterCampaigns).where((0, drizzle_orm_1.eq)(schema_1.newsletterCampaigns.id, campaignId));
        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to delete campaign' });
    }
});
exports.default = router;
