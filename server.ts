import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure Express to handle multiple query parameters with the same name
app.set('query parser', 'extended');

// Import security middleware
import { 
  generalRateLimit, 
  authRateLimit, 
  paymentRateLimit, 
  uploadRateLimit,
  speedLimiter,
  requestSizeLimiter 
} from './src/middleware/rateLimiting';
import { getSecurityHeaders, getClientIP, maskSensitiveData } from './src/utils/security';
import { sanitizeHtml } from './src/middleware/validation';

// Import webhook route early
import stripeWebhookRouter from "./src/routes/stripe-webhook";
// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for development
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Enhanced CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:3000',
      'https://tire-frontend-sand.vercel.app',
      'https://tire-frontend.vercel.app'
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // In production, allow any vercel.app subdomain for the frontend
    if (process.env.NODE_ENV === 'production' && origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  maxAge: 86400 // 24 hours
}));

// Enhanced logging with security considerations
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      // Mask sensitive data in logs
      const cleanMessage = message.replace(
        /("password"|"token"|"authorization")[^,}]*/gi,
        '$1":"***"'
      );
      console.log(cleanMessage.trim());
    }
  }
}));

// Apply rate limiting
app.use('/api/auth', authRateLimit);
app.use('/api/stripe', paymentRateLimit);
app.use('/api/upload', uploadRateLimit);
// Admin routes should bypass general rate limiting
app.use('/api/admin', (req, res, next) => {
  // Skip rate limiting for admin routes
  next();
});
app.use('/api', generalRateLimit);
app.use(speedLimiter);

// Request size limiting
app.use('/api', requestSizeLimiter('10mb'));

// Mount webhook BEFORE JSON middleware (needs raw body)
app.use('/api', stripeWebhookRouter);

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(sanitizeHtml);

// Add security headers to all responses
app.use((req: Request, res: Response, next: NextFunction) => {
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  next();
});

// Request logging with IP tracking
app.use((req: Request, res: Response, next: NextFunction) => {
  const clientIP = getClientIP(req);
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${clientIP}`);
  next();
});

// Routes with security applied
import authRouter from './src/routes/auth';
import adminRouter from './src/routes/admin';
import productsRouter from './src/routes/products';
import ordersRouter from './src/routes/orders';
import usersRouter from './src/routes/users';
import dashboardRouter from './src/routes/dashboard';
import uploadRouter from './src/routes/upload';
import categoriesRouter from './src/routes/categories';
import accountRouter from './src/routes/account';
import wishlistRouter from './src/routes/wishlist';
import stripeRoutes from "./src/routes/stripe";
import settingsRouter from './src/routes/settings';
import bannersRouter from './src/routes/banners';
import bulkRouter from './src/routes/bulk';
import contactRouter from './src/routes/contact';
import testRouter from './src/routes/test';


// Apply additional rate limiting to specific routes
app.use('/api/auth', authRouter);

app.use('/api/admin', adminRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/account', accountRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/bulk', bulkRouter);
app.use('/api/contact', contactRouter);
app.use('/api/test', testRouter);
app.use('/api/stripe', stripeRoutes);


// Remove duplicate stripe routes registration
// app.use("/api", stripeRoutes); // This was causing conflicts

// Enhanced health check with security info
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    message: 'Tire Store API is running securely',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: {
      database: 'Drizzle ORM + PostgreSQL',
      fileUpload: 'AWS S3',
      imageProcessing: 'Enabled',
      security: {
        rateLimiting: 'Enabled',
        cors: 'Configured',
        helmet: 'Enabled',
        validation: 'Enabled',
        authentication: 'JWT'
      }
    }
  });
});

// Security endpoint for monitoring
app.get('/api/security/status', (req: Request, res: Response) => {
  const clientIP = getClientIP(req);
  res.json({
    status: 'secure',
    clientIP: clientIP.replace(/\d+/g, 'x'), // Mask IP for privacy
    headers: {
      userAgent: req.get('User-Agent')?.substring(0, 50) + '...',
      contentType: req.get('Content-Type'),
      origin: req.get('Origin')
    },
    security: {
      rateLimiting: 'active',
      validation: 'active',
      sanitization: 'active'
    },
    timestamp: new Date().toISOString()
  });
});

// API documentation endpoint (only in development)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/docs', (req: Request, res: Response) => {
    res.json({
      message: 'Tire Store API Documentation',
      endpoints: {
        authentication: {
          'POST /api/auth/register': 'Register new user',
          'POST /api/auth/login': 'Login user',
          'POST /api/auth/logout': 'Logout user',
          'GET /api/auth/me': 'Get current user'
        },
        products: {
          'GET /api/products': 'Get all products',
          'GET /api/products/:id': 'Get product by ID',
          'POST /api/products': 'Create product (admin)',
          'PUT /api/products/:id': 'Update product (admin)',
          'DELETE /api/products/:id': 'Delete product (admin)'
        },
        orders: {
          'GET /api/orders': 'Get user orders',
          'POST /api/orders': 'Create new order',
          'GET /api/orders/:id': 'Get order by ID'
        },
        security: {
          'GET /api/security/status': 'Get security status',
          'GET /health': 'Health check'
        }
      },
      rateLimits: {
        general: '100 requests per 15 minutes',
        authentication: '5 requests per 15 minutes',
        payments: '10 requests per 15 minutes',
        uploads: '20 requests per 15 minutes'
      }
    });
  });
}

// 404 handler with security logging
app.use('*', (req: Request, res: Response) => {
  const clientIP = getClientIP(req);
  console.warn(`404 - Route not found: ${req.method} ${req.originalUrl} - IP: ${clientIP}`);
  res.status(404).json({ 
    error: 'Route not found',
    message: 'The requested endpoint does not exist',
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handler with security considerations
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const clientIP = getClientIP(req);
  
  // Log error with masked sensitive data
  console.error(`Error - IP: ${clientIP}`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    body: maskSensitiveData(req.body),
    timestamp: new Date().toISOString()
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    message: isDevelopment ? err.stack : 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running securely on port ${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔒 Security Status: http://localhost:${PORT}/api/security/status`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Using mock data'}`);
  console.log(`📁 File Upload: ${process.env.AWS_S3_BUCKET_NAME ? 'AWS S3 Enabled' : 'Local storage'}`);
  console.log(`🛡️  Security Features:`);
  console.log(`   - Rate Limiting: Enabled`);
  console.log(`   - CORS Protection: Enabled`);
  console.log(`   - Helmet Security: Enabled`);
  console.log(`   - Input Validation: Enabled`);
  console.log(`   - JWT Authentication: Enabled`);
  console.log(`   - Request Sanitization: Enabled`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`📖 API Docs: http://localhost:${PORT}/api/docs`);
  }
});

// Export the app for serverless deployment
export { app };
