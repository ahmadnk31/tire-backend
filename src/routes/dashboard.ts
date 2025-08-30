
import express from 'express';
import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { eq, desc, asc, and, or, like, count, inArray, gte } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { db } from '../db';
import { orders, orderItems, products as productsTable, users as usersTable, users, contactMessages, newsletterSubscriptions, newsletterCampaigns, newsletterCampaignProducts, productImages as productImagesTable } from '../db/schema';
import { sendContactConfirmationEmail, sendAdminNotificationEmail, sendNewsletterWelcomeEmail, sendAdminReplyEmail, sendNewsletterCampaignEmail, sendPasswordResetEmail, sendOrderConfirmationEmail, getProductCatalogTemplate } from '../services/emailService';

const router = Router();

// Recent orders (real data)
router.get('/recent-orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get 10 most recent orders
    const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(10);
    console.log('🔍 [Dashboard] Found recent orders:', recentOrders.length);
    
    // For each order, get first order item and join product and user
    const orderIds = recentOrders.map(o => o.id);
    let itemsByOrderId: Record<number, any> = {};
    if (orderIds.length > 0) {
      const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));
      console.log('🔍 [Dashboard] Found order items:', items.length);
      itemsByOrderId = items.reduce((acc: any, item: any) => {
        if (!acc[item.orderId]) acc[item.orderId] = [];
        acc[item.orderId].push(item);
        return acc;
      }, {});
    }
    const result = await Promise.all(recentOrders.map(async (order) => {
      const firstItem = (itemsByOrderId[order.id] && itemsByOrderId[order.id][0]) || null;
      let productName = '';
      if (firstItem) {
        const prod = await db.select().from(productsTable).where(eq(productsTable.id, firstItem.productId));
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
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});




// Only allow admin users
router.get('/', requireAuth, requireAdmin, (req, res) => {
  res.json({ message: 'Admin dashboard root.' });
});

// Dashboard overview (real data)
router.get('/overview', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Total users
    const usersCount = await db.select().from(usersTable);
    // Total orders
    const ordersCount = await db.select().from(orders);
    // Total products
    const productsCount = await db.select().from(productsTable);
    // Total contact messages
    const contactCount = await db.select().from(contactMessages);
    // Total newsletter subscriptions
    const newsletterCount = await db.select().from(newsletterSubscriptions);
    // Active newsletter subscriptions
    const activeNewsletterCount = await db.select().from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.status, 'active'));
    
    // Total revenue
    const revenueResult = await db.select().from(orders);
    const totalRevenue = revenueResult.reduce((sum, o) => sum + parseFloat(o.total), 0);
    
    // Date calculations
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // New metrics (last 7 days)
    const newUsers = usersCount.filter(u => u.createdAt && u.createdAt > sevenDaysAgo).length;
    const newOrders = ordersCount.filter(o => o.createdAt && o.createdAt > sevenDaysAgo).length;
    const newRevenue = ordersCount.filter(o => o.createdAt && o.createdAt > sevenDaysAgo).reduce((sum, o) => sum + parseFloat(o.total), 0);
    const newContacts = contactCount.filter(c => c.createdAt && c.createdAt > sevenDaysAgo).length;
    const newSubscriptions = newsletterCount.filter(n => n.subscribedAt && n.subscribedAt > sevenDaysAgo).length;
    
    // Pending contact messages
    const pendingContacts = contactCount.filter(c => c.status === 'pending').length;
    
    // Contact messages by type
    const contactsByType = contactCount.reduce((acc: any, contact) => {
      acc[contact.inquiryType] = (acc[contact.inquiryType] || 0) + 1;
      return acc;
    }, {});
    
    // Best selling products (by orderItems quantity)
    const orderItemRows = await db.select().from(orderItems);
    const productSales: Record<number, number> = {};
    orderItemRows.forEach(item => {
      if (item.productId == null) return;
      if (!productSales[item.productId]) productSales[item.productId] = 0;
      productSales[item.productId] += item.quantity;
    });
    const bestSellingIds = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, sold]) => ({ id: Number(id), sold }));
    let bestSellingProducts: any[] = [];
    if (bestSellingIds.length > 0) {
      const prods = await db.select().from(productsTable).where(inArray(productsTable.id, bestSellingIds.map(p => p.id)));
      bestSellingProducts = bestSellingIds.map(({ id, sold }) => {
        const prod = prods.find((p: any) => p.id === id);
        return prod ? { id, name: prod.name, sold } : null;
      }).filter(Boolean);
    }
    
    res.json({
      // Core metrics
      totalUsers: usersCount.length,
      totalOrders: ordersCount.length,
      totalProducts: productsCount.length,
      totalRevenue,
      totalContacts: contactCount.length,
      totalSubscriptions: newsletterCount.length,
      activeSubscriptions: activeNewsletterCount.length,
      
      // New metrics (7 days)
      newUsers,
      newOrders,
      newRevenue,
      newContacts,
      newSubscriptions,
      
      // Contact insights
      pendingContacts,
      contactsByType,
      
      // Products
      bestSellingProducts
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// Contact Messages Management
// GET /api/dashboard/contacts - Get all contact messages with pagination and filters
router.get('/contacts', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const inquiryType = req.query.inquiryType as string;
    const offset = (page - 1) * limit;

    // Build where conditions
    let whereConditions = [];
    if (status) {
      whereConditions.push(eq(contactMessages.status, status));
    }
    if (inquiryType) {
      whereConditions.push(eq(contactMessages.inquiryType, inquiryType));
    }

    // Get total count
    const totalQuery = whereConditions.length > 0 
      ? db.select({ count: count() }).from(contactMessages).where(and(...whereConditions))
      : db.select({ count: count() }).from(contactMessages);
    const [{ count: total }] = await totalQuery;

    // Get messages
    const messagesQuery = whereConditions.length > 0
      ? db.select().from(contactMessages).where(and(...whereConditions)).orderBy(desc(contactMessages.createdAt)).limit(limit).offset(offset)
      : db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(limit).offset(offset);
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
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch contact messages' 
    });
  }
});

// PUT /api/dashboard/contacts/:id - Update contact message status
router.put('/contacts/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const { status, response, adminNotes } = req.body;

    // Validate status
    const validStatuses = ['pending', 'in-progress', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    // Update message
    const [updatedMessage] = await db.update(contactMessages)
      .set({
        status: status || undefined,
        adminResponse: response || undefined,
        updatedAt: new Date()
      })
      .where(eq(contactMessages.id, messageId))
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
  } catch (error) {
    console.error('Error updating contact message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact message'
    });
  }
});

// POST /api/dashboard/contacts/:id/reply - Send email reply to contact
router.post('/contacts/:id/reply', requireAuth, requireAdmin, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const { subject, message, markAsResolved = true } = req.body;

    // Validate input
    const replySchema = z.object({
      subject: z.string().min(1, 'Subject is required'),
      message: z.string().min(10, 'Message must be at least 10 characters')
    });

    const validatedData = replySchema.parse({ subject, message });

    // Get the original contact message
    const [contactMessage] = await db.select().from(contactMessages)
      .where(eq(contactMessages.id, messageId));

    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    // Send reply email using email service
    try {
      await sendAdminReplyEmail(
        contactMessage.email,
        contactMessage.name,
        contactMessage.subject,
        contactMessage.message,
        contactMessage.createdAt?.toLocaleDateString() || new Date().toLocaleDateString(),
        validatedData.subject,
        validatedData.message
      );
      console.log('✅ Admin reply email sent to:', contactMessage.email);
    } catch (emailError) {
      console.error('⚠️ Failed to send admin reply email:', emailError);
      throw new Error('Failed to send email reply');
    }

    // Update message status and add response
    const updateData: any = {
      adminResponse: validatedData.message,
      updatedAt: new Date()
    };

    if (markAsResolved) {
      updateData.status = 'resolved';
    }

    const [updatedMessage] = await db.update(contactMessages)
      .set(updateData)
      .where(eq(contactMessages.id, messageId))
      .returning();

    res.json({
      success: true,
      message: 'Reply sent successfully',
      data: updatedMessage
    });

  } catch (error) {
    console.error('Error sending reply:', error);
    
    if (error instanceof z.ZodError) {
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

// DELETE /api/dashboard/contacts/:id - Delete contact message
router.delete('/contacts/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);

    const [deletedMessage] = await db.delete(contactMessages)
      .where(eq(contactMessages.id, messageId))
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
  } catch (error) {
    console.error('Error deleting contact message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact message'
    });
  }
});

// Newsletter Subscriptions Management
// GET /api/dashboard/subscriptions - Get all newsletter subscriptions with pagination and filters
router.get('/subscriptions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const source = req.query.source as string;
    const offset = (page - 1) * limit;

    // Build where conditions
    let whereConditions = [];
    if (status) {
      whereConditions.push(eq(newsletterSubscriptions.status, status));
    }
    if (source) {
      whereConditions.push(eq(newsletterSubscriptions.source, source));
    }

    // Get total count
    const totalQuery = whereConditions.length > 0 
      ? db.select({ count: count() }).from(newsletterSubscriptions).where(and(...whereConditions))
      : db.select({ count: count() }).from(newsletterSubscriptions);
    const [{ count: total }] = await totalQuery;

    // Get subscriptions
    const subscriptionsQuery = whereConditions.length > 0
      ? db.select().from(newsletterSubscriptions).where(and(...whereConditions)).orderBy(desc(newsletterSubscriptions.subscribedAt)).limit(limit).offset(offset)
      : db.select().from(newsletterSubscriptions).orderBy(desc(newsletterSubscriptions.subscribedAt)).limit(limit).offset(offset);
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
  } catch (error) {
    console.error('Error fetching newsletter subscriptions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch newsletter subscriptions' 
    });
  }
});

// PUT /api/dashboard/subscriptions/:id - Update subscription status
router.put('/subscriptions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const subscriptionId = parseInt(req.params.id);
    const { status, tags, metadata } = req.body;

    // Validate status
    const validStatuses = ['active', 'unsubscribed', 'bounced'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    // Update subscription
    const updateData: any = {};

    if (status) {
      updateData.status = status;
      if (status === 'unsubscribed') {
        updateData.unsubscribedAt = new Date();
      } else if (status === 'active') {
        updateData.unsubscribedAt = null;
      }
    }

    if (tags) updateData.tags = tags;
    if (metadata) updateData.metadata = metadata;

    const [updatedSubscription] = await db.update(newsletterSubscriptions)
      .set(updateData)
      .where(eq(newsletterSubscriptions.id, subscriptionId))
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
  } catch (error) {
    console.error('Error updating newsletter subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update newsletter subscription'
    });
  }
});

// POST /api/dashboard/subscriptions/send-email - Send custom email to subscribers
router.post('/subscriptions/send-email', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { subject, message, recipients, tags } = req.body;

    // Validate input
    const emailSchema = z.object({
      subject: z.string().min(1, 'Subject is required'),
      message: z.string().min(10, 'Message must be at least 10 characters'),
      recipients: z.enum(['all', 'active', 'specific']).default('active'),
      tags: z.array(z.string()).optional()
    });

    const validatedData = emailSchema.parse({ subject, message, recipients, tags });

    // Get recipients based on selection
    let whereConditions = [];
    
    if (validatedData.recipients === 'active') {
      whereConditions.push(eq(newsletterSubscriptions.status, 'active'));
    } else if (validatedData.recipients === 'specific' && validatedData.tags) {
      // If specific tags are provided, filter by those
      whereConditions.push(eq(newsletterSubscriptions.status, 'active'));
      // Note: This would need a more complex query for JSONB tag filtering
    }

    const subscribersQuery = whereConditions.length > 0
      ? db.select().from(newsletterSubscriptions).where(and(...whereConditions))
      : db.select().from(newsletterSubscriptions);
    
    const subscribers = await subscribersQuery;

    if (subscribers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No subscribers found for the selected criteria'
      });
    }

    // Send emails using email service (in batches to avoid overwhelming SES)
    let successCount = 0;
    let failureCount = 0;
    const batchSize = 10; // Send in batches of 10

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const emailPromises = batch.map(async (subscriber) => {
        try {
          const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
          
          await sendNewsletterCampaignEmail(
            subscriber.email,
            validatedData.subject,
            validatedData.message,
            unsubscribeUrl
          );
          
          // Update last email sent timestamp
          await db.update(newsletterSubscriptions)
            .set({ lastEmailSent: new Date() })
            .where(eq(newsletterSubscriptions.id, subscriber.id));
          
          successCount++;
          console.log(`✅ Newsletter email sent to: ${subscriber.email}`);
        } catch (error) {
          console.error(`⚠️ Failed to send email to ${subscriber.email}:`, error);
          failureCount++;
        }
      });

      await Promise.all(emailPromises);
      
      // Small delay between batches
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

  } catch (error) {
    console.error('Error sending newsletter email:', error);
    
    if (error instanceof z.ZodError) {
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

// POST /api/dashboard/contacts/:id/resend-confirmation - Resend contact confirmation email
router.post('/contacts/:id/resend-confirmation', requireAuth, requireAdmin, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);

    // Get the contact message
    const [contactMessage] = await db.select().from(contactMessages)
      .where(eq(contactMessages.id, messageId));

    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    // Resend confirmation email using the proper template
    try {
      await sendContactConfirmationEmail(
        contactMessage.email,
        contactMessage.name,
        contactMessage.inquiryType,
        contactMessage.subject
      );
      console.log('✅ Contact confirmation email resent to:', contactMessage.email);
    } catch (emailError) {
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

  } catch (error) {
    console.error('Error resending contact confirmation:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to resend confirmation email'
    });
  }
});

// POST /api/dashboard/contacts/:id/notify-admin - Send admin notification for existing contact
router.post('/contacts/:id/notify-admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const { adminEmail } = req.body;

    if (!adminEmail) {
      return res.status(400).json({
        success: false,
        message: 'Admin email is required'
      });
    }

    // Get the contact message
    const [contactMessage] = await db.select().from(contactMessages)
      .where(eq(contactMessages.id, messageId));

    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    // Send admin notification using the proper template
    try {
      await sendAdminNotificationEmail(
        adminEmail,
        contactMessage.name,
        contactMessage.email,
        contactMessage.inquiryType,
        contactMessage.subject,
        contactMessage.message,
        contactMessage.phone || undefined
      );
      console.log('✅ Admin notification email sent to:', adminEmail);
    } catch (emailError) {
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

  } catch (error) {
    console.error('Error sending admin notification:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send admin notification'
    });
  }
});

// POST /api/dashboard/subscriptions/:id/resend-welcome - Resend newsletter welcome email
router.post('/subscriptions/:id/resend-welcome', requireAuth, requireAdmin, async (req, res) => {
  try {
    const subscriptionId = parseInt(req.params.id);

    // Get the subscription
    const [subscription] = await db.select().from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.id, subscriptionId));

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Newsletter subscription not found'
      });
    }

    // Resend welcome email using the proper template
    try {
      await sendNewsletterWelcomeEmail(subscription.email);
      console.log('✅ Newsletter welcome email resent to:', subscription.email);
    } catch (emailError) {
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

  } catch (error) {
    console.error('Error resending newsletter welcome:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to resend welcome email'
    });
  }
});

// POST /api/dashboard/users/:id/resend-password-reset - Resend password reset email
router.post('/users/:id/resend-password-reset', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Get the user
    const [user] = await db.select().from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate a new reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Update user with reset token
    await db.update(users)
      .set({
        resetToken: resetToken
      })
      .where(eq(users.id, userId));

    // Send password reset email using the proper template
    try {
      await sendPasswordResetEmail(user.email, resetToken);
      console.log('✅ Password reset email sent to:', user.email);
    } catch (emailError) {
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

  } catch (error) {
    console.error('Error sending password reset email:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send password reset email'
    });
  }
});

// POST /api/dashboard/orders/:id/resend-confirmation - Resend order confirmation email
router.post('/orders/:id/resend-confirmation', requireAuth, requireAdmin, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    // Get the order with user details
    const [order] = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      total: orders.total,
      status: orders.status,
      userEmail: orders.userEmail,
      userName: orders.userName
    })
    .from(orders)
    .where(eq(orders.id, orderId));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get order items for the email
    const orderItemsData = await db.select({
      productName: orderItems.productName,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

    // Send order confirmation email using the proper template
    try {
      await sendOrderConfirmationEmail(
        order.userEmail,
        order.userName,
        order.orderNumber,
        orderItemsData.map(item => ({
          name: item.productName,
          quantity: item.quantity,
          price: parseFloat(item.unitPrice.toString())
        })),
        parseFloat(order.total.toString())
      );
      console.log('✅ Order confirmation email resent to:', order.userEmail);
    } catch (emailError) {
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

  } catch (error) {
    console.error('Error resending order confirmation:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to resend order confirmation email'
    });
  }
});

// DELETE /api/dashboard/subscriptions/:id - Delete subscription
router.delete('/subscriptions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const subscriptionId = parseInt(req.params.id);

    const [deletedSubscription] = await db.delete(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.id, subscriptionId))
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
  } catch (error) {
    console.error('Error deleting newsletter subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete newsletter subscription'
    });
  }
});

// Low stock products (real data)
router.get('/low-stock', requireAuth, requireAdmin, async (req, res) => {
  try {
    const lowStockProducts = await db.select().from(productsTable);
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
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

// Newsletter Campaign Management

// Get all campaigns
router.get('/campaigns', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const type = req.query.type as string;
    const offset = (page - 1) * limit;

    // Build where conditions
    let whereConditions = [];
    if (status) {
      whereConditions.push(eq(newsletterCampaigns.status, status));
    }
    if (type) {
      whereConditions.push(eq(newsletterCampaigns.type, type));
    }

    // Get total count
    const totalQuery = whereConditions.length > 0 
      ? db.select({ count: count() }).from(newsletterCampaigns).where(and(...whereConditions))
      : db.select({ count: count() }).from(newsletterCampaigns);
    const [{ count: total }] = await totalQuery;

    // Get campaigns
    const campaignsQuery = whereConditions.length > 0
      ? db.select().from(newsletterCampaigns).where(and(...whereConditions)).orderBy(desc(newsletterCampaigns.createdAt)).limit(limit).offset(offset)
      : db.select().from(newsletterCampaigns).orderBy(desc(newsletterCampaigns.createdAt)).limit(limit).offset(offset);
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
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
  }
});

// Create new campaign
const createCampaignSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['general', 'product_catalog', 'promotional']).default('general'),
  productIds: z.array(z.number()).optional(),
  scheduledAt: z.string().optional(),
});

router.post('/campaigns', requireAuth, requireAdmin, async (req, res) => {
  try {
    const validatedData = createCampaignSchema.parse(req.body);
    const userId = (req as any).user.id;

    // Create campaign
    const [campaign] = await db.insert(newsletterCampaigns).values({
      title: validatedData.title,
      subject: validatedData.subject,
      content: validatedData.content,
      type: validatedData.type,
      scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
      createdBy: userId,
    }).returning();

    // Add products if it's a product catalog campaign
    if (validatedData.type === 'product_catalog' && validatedData.productIds?.length) {
      console.log('📦 Creating product catalog campaign with products:', validatedData.productIds);
      const productInserts = validatedData.productIds.map((productId, index) => ({
        campaignId: campaign.id,
        productId,
        displayOrder: index,
      }));
      await db.insert(newsletterCampaignProducts).values(productInserts);
      console.log('✅ Inserted campaign products:', productInserts.length);
    } else {
      console.log('⚠️ No products provided for campaign type:', validatedData.type);
      console.log('⚠️ Product IDs:', validatedData.productIds);
    }

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    console.error('Error creating campaign:', error);
    res.status(500).json({ success: false, error: 'Failed to create campaign' });
  }
});

// Get campaign with products
router.get('/campaigns/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    
    // Get campaign
    const [campaign] = await db.select().from(newsletterCampaigns).where(eq(newsletterCampaigns.id, campaignId));
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    // Get campaign products if it's a product catalog
    let products: any[] = [];
    if (campaign.type === 'product_catalog') {
      const campaignProducts = await db
        .select({
          productId: newsletterCampaignProducts.productId,
          displayOrder: newsletterCampaignProducts.displayOrder,
          product: productsTable,
        })
        .from(newsletterCampaignProducts)
        .leftJoin(productsTable, eq(newsletterCampaignProducts.productId, productsTable.id))
        .where(eq(newsletterCampaignProducts.campaignId, campaignId))
        .orderBy(asc(newsletterCampaignProducts.displayOrder));
      
      products = campaignProducts.map(cp => cp.product);
    }

    res.json({
      success: true,
      data: {
        ...campaign,
        products
      }
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch campaign' });
  }
});

// Send campaign
router.post('/campaigns/:id/send', requireAuth, requireAdmin, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const { subscriberFilter } = req.body; // 'all', 'active', etc.

    // Get campaign
    const [campaign] = await db.select().from(newsletterCampaigns).where(eq(newsletterCampaigns.id, campaignId));
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (campaign.status === 'sent') {
      return res.status(400).json({ success: false, error: 'Campaign already sent' });
    }

    // Get subscribers
    let whereConditions = [eq(newsletterSubscriptions.status, 'active')];
    if (subscriberFilter && subscriberFilter !== 'all') {
      whereConditions.push(eq(newsletterSubscriptions.source, subscriberFilter));
    }

    const subscribers = await db.select().from(newsletterSubscriptions).where(and(...whereConditions));

    if (subscribers.length === 0) {
      return res.status(400).json({ success: false, error: 'No active subscribers found' });
    }

    let emailContent = campaign.content;
    let emailSubject = campaign.subject;

    // If it's a product catalog campaign, use the product catalog template
    if (campaign.type === 'product_catalog') {
      console.log('🛍️ Processing product catalog campaign:', campaignId);
      
      // Get campaign products with images
      const campaignProducts = await db
        .select({
          productId: newsletterCampaignProducts.productId,
          displayOrder: newsletterCampaignProducts.displayOrder,
          // Select individual product fields instead of the entire table
          productData: {
            id: productsTable.id,
            name: productsTable.name,
            brand: productsTable.brand,
            model: productsTable.model,
            size: productsTable.size,
            price: productsTable.price,
            comparePrice: productsTable.comparePrice,
            rating: productsTable.rating,
            stock: productsTable.stock,
            description: productsTable.description,
          }
        })
        .from(newsletterCampaignProducts)
        .leftJoin(productsTable, eq(newsletterCampaignProducts.productId, productsTable.id))
        .where(eq(newsletterCampaignProducts.campaignId, campaignId))
        .orderBy(asc(newsletterCampaignProducts.displayOrder));

      console.log('📦 Found campaign products:', campaignProducts.length);
      console.log('📦 Campaign products details:', campaignProducts.map(cp => ({
        productId: cp.productId,
        displayOrder: cp.displayOrder,
        productData: cp.productData ? { id: cp.productData.id, name: cp.productData.name } : null
      })));

      // Debug: Check if these products exist in the products table
      if (campaignProducts.length > 0) {
        const productIds = campaignProducts.map(cp => cp.productId).filter(id => id !== null);
        console.log('🔍 Checking if products exist in products table for IDs:', productIds);
        
        const existingProducts = await db
          .select({ id: productsTable.id, name: productsTable.name })
          .from(productsTable)
          .where(inArray(productsTable.id, productIds));
        
        console.log('✅ Found existing products:', existingProducts);
        
        // Check data types
        console.log('🔍 Product ID types in campaign:', productIds.map(id => typeof id));
        console.log('🔍 Product ID types in products table:', existingProducts.map(p => typeof p.id));
        
        // Try a direct query to test JOIN
        console.log('🧪 Testing direct JOIN query...');
        const testJoin = await db
          .select({
            campaignProductId: newsletterCampaignProducts.productId,
            productId: productsTable.id,
            productName: productsTable.name,
          })
          .from(newsletterCampaignProducts)
          .leftJoin(productsTable, eq(newsletterCampaignProducts.productId, productsTable.id))
          .where(eq(newsletterCampaignProducts.campaignId, campaignId));
        
        console.log('🧪 Direct JOIN test results:', testJoin);
      }

      // Get images for all campaign products
      const productIds = campaignProducts
        .map(cp => cp.productId)
        .filter((id): id is number => id !== null && id !== undefined);
      
      console.log('🔍 Product IDs to fetch images for:', productIds);
      
      const productImages = productIds.length > 0 ? await db
        .select()
        .from(productImagesTable)
        .where(inArray(productImagesTable.productId, productIds))
        .orderBy(asc(productImagesTable.sortOrder)) : [];

      console.log('🖼️ Found product images:', productImages.length);

      // Group images by productId
      const imagesByProductId = productImages.reduce((acc, img) => {
        if (img.productId !== null) {
          if (!acc[img.productId]) acc[img.productId] = [];
          acc[img.productId].push(img.imageUrl);
        }
        return acc;
      }, {} as Record<number, string[]>);

      console.log('📸 Images grouped by product ID:', imagesByProductId);

      const products = campaignProducts
        .filter(cp => cp.productData !== null && cp.productData.id !== null) // Filter out null products
        .map(cp => ({
          id: cp.productData!.id,
          name: cp.productData!.name,
          brand: cp.productData!.brand,
          model: cp.productData!.model,
          size: cp.productData!.size,
          price: cp.productData!.price,
          comparePrice: cp.productData!.comparePrice || undefined,
          images: imagesByProductId[cp.productData!.id] || [],
          rating: cp.productData!.rating || undefined,
          stock: cp.productData!.stock,
          description: cp.productData!.description || undefined,
        }));

      console.log('✅ Final products for email template:', products.length);
      console.log('✅ Products details:', products);

      // Generate product catalog email
      const websiteUrl = process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app';
      emailContent = getProductCatalogTemplate({
        products,
        campaignTitle: campaign.title,
        websiteUrl
      });
      
      console.log('📧 Generated email content length:', emailContent.length);
      console.log('📧 Email content preview:', emailContent.substring(0, 500) + '...');
    }

    // Send emails to all subscribers
    const emailPromises = subscribers.map(async (subscriber) => {
      const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app'}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
      
      if (campaign.type === 'product_catalog') {
        // For product catalog, emailContent is already the full HTML
        await sendNewsletterCampaignEmail(subscriber.email, emailSubject, emailContent, unsubscribeUrl);
      } else {
        // For general campaigns, use the regular newsletter template
        await sendNewsletterCampaignEmail(subscriber.email, emailSubject, emailContent, unsubscribeUrl);
      }
    });

    await Promise.all(emailPromises);

    // Update campaign status
    await db.update(newsletterCampaigns)
      .set({
        status: 'sent',
        sentAt: new Date(),
        recipientCount: subscribers.length,
        updatedAt: new Date(),
      })
      .where(eq(newsletterCampaigns.id, campaignId));

    res.json({
      success: true,
      message: `Campaign sent to ${subscribers.length} subscribers`,
      data: {
        recipientCount: subscribers.length,
        sentAt: new Date(),
      }
    });
  } catch (error) {
    console.error('Error sending campaign:', error);
    res.status(500).json({ success: false, error: 'Failed to send campaign' });
  }
});

// Delete campaign
router.delete('/campaigns/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);

    // Delete campaign products first (cascade will handle this, but being explicit)
    await db.delete(newsletterCampaignProducts).where(eq(newsletterCampaignProducts.campaignId, campaignId));
    
    // Delete campaign
    await db.delete(newsletterCampaigns).where(eq(newsletterCampaigns.id, campaignId));

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, error: 'Failed to delete campaign' });
  }
});

export default router;
