"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 3001;
app.set('query parser', 'extended');
const rateLimiting_1 = require("./src/middleware/rateLimiting");
const security_1 = require("./src/utils/security");
const validation_1 = require("./src/middleware/validation");
const stripe_webhook_1 = __importDefault(require("./src/routes/stripe-webhook"));
app.use((0, helmet_1.default)({
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
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://localhost:8080',
            'http://localhost:8081',
            'http://localhost:3000',
            'https://tire-frontend-sand.vercel.app',
            'https://tire-frontend.vercel.app'
        ];
        if (!origin)
            return callback(null, true);
        if (process.env.NODE_ENV === 'production' && origin.includes('.vercel.app')) {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    maxAge: 86400
}));
app.use((0, morgan_1.default)('combined', {
    stream: {
        write: (message) => {
            const cleanMessage = message.replace(/("password"|"token"|"authorization")[^,}]*/gi, '$1":"***"');
            console.log(cleanMessage.trim());
        }
    }
}));
app.use('/api/auth', rateLimiting_1.authRateLimit);
app.use('/api/stripe', rateLimiting_1.paymentRateLimit);
app.use('/api/upload', rateLimiting_1.uploadRateLimit);
app.use('/api/admin', (req, res, next) => {
    next();
});
app.use('/api', rateLimiting_1.generalRateLimit);
app.use(rateLimiting_1.speedLimiter);
app.use('/api', (0, rateLimiting_1.requestSizeLimiter)('10mb'));
app.use('/api', stripe_webhook_1.default);
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(validation_1.sanitizeHtml);
app.use((req, res, next) => {
    const securityHeaders = (0, security_1.getSecurityHeaders)();
    Object.entries(securityHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
    next();
});
app.use((req, res, next) => {
    const clientIP = (0, security_1.getClientIP)(req);
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${clientIP}`);
    next();
});
const auth_1 = __importDefault(require("./src/routes/auth"));
const admin_1 = __importDefault(require("./src/routes/admin"));
const products_1 = __importDefault(require("./src/routes/products"));
const orders_1 = __importDefault(require("./src/routes/orders"));
const users_1 = __importDefault(require("./src/routes/users"));
const dashboard_1 = __importDefault(require("./src/routes/dashboard"));
const upload_1 = __importDefault(require("./src/routes/upload"));
const categories_1 = __importDefault(require("./src/routes/categories"));
const account_1 = __importDefault(require("./src/routes/account"));
const wishlist_1 = __importDefault(require("./src/routes/wishlist"));
const stripe_1 = __importDefault(require("./src/routes/stripe"));
const settings_1 = __importDefault(require("./src/routes/settings"));
const banners_1 = __importDefault(require("./src/routes/banners"));
const bulk_1 = __importDefault(require("./src/routes/bulk"));
const contact_1 = __importDefault(require("./src/routes/contact"));
app.use('/api/auth', auth_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/products', products_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/users', users_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/account', account_1.default);
app.use('/api/wishlist', wishlist_1.default);
app.use('/api/banners', banners_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/bulk', bulk_1.default);
app.use('/api/contact', contact_1.default);
app.use('/api/stripe', stripe_1.default);
app.get('/health', (req, res) => {
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
app.get('/api/security/status', (req, res) => {
    const clientIP = (0, security_1.getClientIP)(req);
    res.json({
        status: 'secure',
        clientIP: clientIP.replace(/\d+/g, 'x'),
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
if (process.env.NODE_ENV === 'development') {
    app.get('/api/docs', (req, res) => {
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
app.use('*', (req, res) => {
    const clientIP = (0, security_1.getClientIP)(req);
    console.warn(`404 - Route not found: ${req.method} ${req.originalUrl} - IP: ${clientIP}`);
    res.status(404).json({
        error: 'Route not found',
        message: 'The requested endpoint does not exist',
        timestamp: new Date().toISOString()
    });
});
app.use((err, req, res, next) => {
    const clientIP = (0, security_1.getClientIP)(req);
    console.error(`Error - IP: ${clientIP}`, {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method,
        body: (0, security_1.maskSensitiveData)(req.body),
        timestamp: new Date().toISOString()
    });
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
