const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

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
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:3000',
      'https://tire-frontend-sand.vercel.app',
      'https://tire-frontend.vercel.app'
    ];
    
    if (!origin) return callback(null, true);
    if (origin && origin.includes('.vercel.app')) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for debugging
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  maxAge: 86400
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined'));

// Import all route modules
try {
  const authRouter = require('../../dist/src/routes/auth');
  const adminRouter = require('../../dist/src/routes/admin');
  const productsRouter = require('../../dist/src/routes/products');
  const ordersRouter = require('../../dist/src/routes/orders');
  const usersRouter = require('../../dist/src/routes/users');
  const dashboardRouter = require('../../dist/src/routes/dashboard');
  const uploadRouter = require('../../dist/src/routes/upload');
  const categoriesRouter = require('../../dist/src/routes/categories');
  const accountRouter = require('../../dist/src/routes/account');
  const wishlistRouter = require('../../dist/src/routes/wishlist');
  const bannersRouter = require('../../dist/src/routes/banners');
  const settingsRouter = require('../../dist/src/routes/settings');
  const bulkRouter = require('../../dist/src/routes/bulk');
  const stripeRoutes = require('../../dist/src/routes/stripe');
  const stripeWebhookRouter = require('../../dist/src/routes/stripe-webhook');

  // Mount webhook BEFORE other routes (needs raw body)
  app.use('/api', stripeWebhookRouter.default || stripeWebhookRouter);

  // Mount all API routes
  app.use('/api/auth', authRouter.default || authRouter);
  app.use('/api/admin', adminRouter.default || adminRouter);
  app.use('/api/products', productsRouter.default || productsRouter);
  app.use('/api/orders', ordersRouter.default || ordersRouter);
  app.use('/api/users', usersRouter.default || usersRouter);
  app.use('/api/dashboard', dashboardRouter.default || dashboardRouter);
  app.use('/api/upload', uploadRouter.default || uploadRouter);
  app.use('/api/categories', categoriesRouter.default || categoriesRouter);
  app.use('/api/account', accountRouter.default || accountRouter);
  app.use('/api/wishlist', wishlistRouter.default || wishlistRouter);
  app.use('/api/banners', bannersRouter.default || bannersRouter);
  app.use('/api/settings', settingsRouter.default || settingsRouter);
  app.use('/api/bulk', bulkRouter.default || bulkRouter);
  app.use('/api/stripe', stripeRoutes.default || stripeRoutes);

} catch (error) {
  console.error('Error loading routes:', error.message);
  console.error('Stack:', error.stack);
  
  // If routes fail to load, provide error info
  app.get('/api/*', (req, res) => {
    res.status(500).json({
      error: 'Routes failed to load',
      message: error.message,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Tire Store API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Tire Store API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'POST /api/auth/logout',
        'POST /api/auth/refresh',
        'POST /api/auth/forgot-password',
        'POST /api/auth/reset-password'
      ],
      products: [
        'GET /api/products',
        'GET /api/products/:id',
        'POST /api/products',
        'PUT /api/products/:id',
        'DELETE /api/products/:id',
        'GET /api/products/featured/list',
        'GET /api/products/search',
        'GET /api/products/category/:categoryId'
      ],
      categories: [
        'GET /api/categories',
        'GET /api/categories/:id',
        'POST /api/categories',
        'PUT /api/categories/:id',
        'DELETE /api/categories/:id'
      ],
      banners: [
        'GET /api/banners',
        'GET /api/banners/:id',
        'POST /api/banners',
        'PUT /api/banners/:id',
        'DELETE /api/banners/:id'
      ],
      orders: [
        'GET /api/orders',
        'GET /api/orders/:id',
        'POST /api/orders',
        'PUT /api/orders/:id',
        'DELETE /api/orders/:id'
      ],
      users: [
        'GET /api/users',
        'GET /api/users/:id',
        'PUT /api/users/:id',
        'DELETE /api/users/:id'
      ],
      wishlist: [
        'GET /api/wishlist',
        'POST /api/wishlist',
        'DELETE /api/wishlist/:id'
      ],
      account: [
        'GET /api/account/profile',
        'PUT /api/account/profile',
        'GET /api/account/orders',
        'POST /api/account/change-password'
      ],
      upload: [
        'POST /api/upload/image',
        'POST /api/upload/multiple'
      ],
      stripe: [
        'POST /api/stripe/create-payment-intent',
        'POST /api/stripe/confirm-payment',
        'POST /api/stripe/webhooks'
      ],
      admin: [
        'GET /api/admin/dashboard',
        'GET /api/admin/users',
        'GET /api/admin/orders',
        'GET /api/admin/products',
        'GET /api/admin/analytics'
      ],
      settings: [
        'GET /api/settings',
        'PUT /api/settings'
      ],
      bulk: [
        'POST /api/bulk/products',
        'POST /api/bulk/categories',
        'POST /api/bulk/users'
      ]
    }
  });
});

// Catch unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: '/api'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

module.exports.handler = serverless(app);
