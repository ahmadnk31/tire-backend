import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimiting';
import { db } from '../db';
import { contactMessages, newsletterSubscriptions } from '../db/schema';
import { eq, count } from 'drizzle-orm';
import { sendContactConfirmationEmail, sendAdminNotificationEmail, sendNewsletterWelcomeEmail } from '../services/emailService';

const router = Router();

// Contact form submission schema
const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200, 'Subject too long'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Message too long'),
  inquiryType: z.enum(['general', 'quote', 'appointment', 'warranty', 'complaint', 'support']),
});

// Newsletter subscription schema
const newsletterSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().optional(),
});

// Apply rate limiting to contact endpoints
router.use(authRateLimit);

// POST /api/contact - Submit contact form
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = contactFormSchema.parse(req.body);
    
    // Get client information
    const clientIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || '';
    
    // Save to database
    const [contactEntry] = await db.insert(contactMessages).values({
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone || null,
      subject: validatedData.subject,
      message: validatedData.message,
      inquiryType: validatedData.inquiryType,
      clientIP,
      userAgent,
      userId: (req as any).user?.id || null, // If user is logged in
    }).returning();

    // Log the contact submission
    console.log('Contact form submission saved:', {
      id: contactEntry.id,
      email: validatedData.email,
      inquiryType: validatedData.inquiryType,
      submittedAt: contactEntry.createdAt,
      clientIP,
    });

    // Send confirmation email to customer
    try {
      await sendContactConfirmationEmail(
        validatedData.email,
        validatedData.name,
        validatedData.inquiryType,
        validatedData.subject
      );
      console.log('✅ Confirmation email sent to:', validatedData.email);
    } catch (emailError) {
      console.warn('⚠️ Failed to send confirmation email:', emailError);
    }

    // Send notification email to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@arianabandencentraal.nl';
      await sendAdminNotificationEmail(
        adminEmail,
        validatedData.name,
        validatedData.email,
        validatedData.inquiryType,
        validatedData.subject,
        validatedData.message,
        validatedData.phone
      );
      console.log('✅ Admin notification email sent to:', adminEmail);
    } catch (emailError) {
      console.warn('⚠️ Failed to send admin notification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Your message has been received. We will get back to you within 24 hours.',
      data: {
        id: contactEntry.id,
        submittedAt: contactEntry.createdAt,
        estimatedResponseTime: '24 hours',
      }
    });

  } catch (error) {
    console.error('Contact form submission error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid form data',
        errors: error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process your request. Please try again or contact us directly.',
    });
  }
});

// POST /api/contact/newsletter - Newsletter subscription
router.post('/newsletter', async (req: Request, res: Response) => {
  try {
    const validatedData = newsletterSchema.parse(req.body);
    
    // Check if email already exists
    const existingSubscription = await db.query.newsletterSubscriptions.findFirst({
      where: (subscriptions, { eq }) => eq(subscriptions.email, validatedData.email)
    });

    if (existingSubscription) {
      if (existingSubscription.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'This email is already subscribed to our newsletter.',
        });
      } else {
        // Reactivate subscription
        const [updatedSubscription] = await db.update(newsletterSubscriptions)
          .set({
            status: 'active',
            name: validatedData.name || existingSubscription.name,
            subscribedAt: new Date(),
            unsubscribedAt: null,
          })
          .where(eq(newsletterSubscriptions.email, validatedData.email))
          .returning();

        return res.status(200).json({
          success: true,
          message: 'Successfully reactivated your newsletter subscription!',
          data: {
            id: updatedSubscription.id,
            email: updatedSubscription.email,
            subscribedAt: updatedSubscription.subscribedAt,
          }
        });
      }
    }

    // Create new subscription
    const [subscription] = await db.insert(newsletterSubscriptions).values({
      email: validatedData.email,
      name: validatedData.name || null,
      source: 'website',
    }).returning();
    
    console.log('Newsletter subscription saved:', {
      id: subscription.id,
      email: subscription.email,
      subscribedAt: subscription.subscribedAt,
      clientIP: req.ip || 'unknown',
    });

    // Send welcome email
    try {
      await sendNewsletterWelcomeEmail(validatedData.email, validatedData.name);
      console.log('✅ Newsletter welcome email sent to:', validatedData.email);
    } catch (emailError) {
      console.warn('⚠️ Failed to send newsletter welcome email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to our newsletter!',
      data: {
        id: subscription.id,
        email: subscription.email,
        subscribedAt: subscription.subscribedAt,
      }
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
        errors: error.issues
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to subscribe. Please try again.',
    });
  }
});

// GET /api/contact/info - Get contact information
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      store: {
        name: 'Ariana Bandencentraal',
        address: {
          street: '123 Tire Street',
          city: 'Amsterdam',
          country: 'Netherlands',
          postalCode: '1234 AB',
        },
        coordinates: {
          latitude: 52.3676,
          longitude: 4.9041,
        }
      },
      contact: {
        phone: '+31 20 123 4567',
        email: 'info@arianabandencentraal.nl',
        whatsapp: '+31 6 1234 5678',
        emergency: '+31 6 9999 0000',
      },
      businessHours: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '08:00', close: '16:00' },
        sunday: { closed: true },
      },
      services: [
        'Tire Installation',
        'Wheel Balancing',
        'Alignment Services',
        'Tire Repair',
        'Emergency Roadside Assistance',
        'Tire Storage',
      ],
      languages: ['Dutch', 'English', 'German'],
    }
  });
});

// GET /api/contact/faqs - Get frequently asked questions
router.get('/faqs', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        question: 'What tire sizes do you have in stock?',
        answer: 'We stock a wide range of tire sizes for cars, SUVs, and motorcycles. Use our size guide to find your specific size, or contact us for availability.',
        category: 'products'
      },
      {
        id: 2,
        question: 'Do you offer tire installation?',
        answer: 'Yes, we provide professional tire installation, balancing, and alignment services. Installation is included with tire purchases.',
        category: 'services'
      },
      {
        id: 3,
        question: 'What are your business hours?',
        answer: 'We are open Monday-Friday 8:00-18:00, Saturday 8:00-16:00, and closed on Sunday. Emergency service is available 24/7.',
        category: 'general'
      },
      {
        id: 4,
        question: 'Do you offer warranties on tires?',
        answer: 'Yes, all our tires come with manufacturer warranties. We also offer additional road hazard protection plans.',
        category: 'warranty'
      },
      {
        id: 5,
        question: 'Can you store my seasonal tires?',
        answer: 'Yes, we offer tire storage services for seasonal tires. Contact us for pricing and availability.',
        category: 'services'
      }
    ]
  });
});

// Admin routes (require authentication)
// GET /api/contact/messages - Get all contact messages (admin only)
router.get('/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Get query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const inquiryType = req.query.inquiryType as string;
    
    const offset = (page - 1) * limit;

    // Build query conditions
    let whereConditions: any[] = [];
    if (status) {
      whereConditions.push(eq(contactMessages.status, status));
    }
    if (inquiryType) {
      whereConditions.push(eq(contactMessages.inquiryType, inquiryType));
    }

    // Fetch messages from database
    const messages = await db.query.contactMessages.findMany({
      limit,
      offset,
      orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    // Get total count for pagination
    const totalResult = await db.select({ count: count() }).from(contactMessages);
    const total = totalResult[0]?.count || 0;

    res.json({
      success: true,
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      }
    });

  } catch (error) {
    console.error('Error fetching contact messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

// PUT /api/contact/messages/:id - Update message status (admin only)
router.put('/messages/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { id } = req.params;
    const { status, adminResponse } = req.body;

    // Validate status
    const validStatuses = ['pending', 'in-progress', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Check if message exists
    const existingMessage = await db.query.contactMessages.findFirst({
      where: eq(contactMessages.id, parseInt(id))
    });

    if (!existingMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    // Update the message
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (status) updateData.status = status;
    if (adminResponse) updateData.adminResponse = adminResponse;

    const [updatedMessage] = await db.update(contactMessages)
      .set(updateData)
      .where(eq(contactMessages.id, parseInt(id)))
      .returning();

    console.log(`Updated contact message ${id}:`, { status, adminResponse });

    res.json({
      success: true,
      message: 'Message updated successfully',
      data: {
        id: updatedMessage.id,
        status: updatedMessage.status,
        adminResponse: updatedMessage.adminResponse,
        updatedAt: updatedMessage.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating contact message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update message'
    });
  }
});

// Unsubscribe from newsletter
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email, token } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    // Find the subscription
    const [subscription] = await db.select()
      .from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.email, email));

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Email address not found in our newsletter list'
      });
    }

    if (subscription.status === 'unsubscribed') {
      return res.json({
        success: true,
        message: 'You are already unsubscribed from our newsletter'
      });
    }

    // Update subscription status to unsubscribed
    await db.update(newsletterSubscriptions)
      .set({
        status: 'unsubscribed',
        unsubscribedAt: new Date(),
      })
      .where(eq(newsletterSubscriptions.email, email));

    res.json({
      success: true,
      message: 'You have been successfully unsubscribed from our newsletter'
    });

  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe. Please try again later.'
    });
  }
});

export default router;
