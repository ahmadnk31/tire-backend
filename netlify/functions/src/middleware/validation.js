"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeHtml = exports.fileUploadValidation = exports.advancedSearchValidation = exports.searchValidation = exports.paginationValidation = exports.orderValidation = exports.loginValidation = exports.registerValidation = exports.productValidation = exports.idParamValidation = exports.nameValidation = exports.passwordValidation = exports.emailValidation = exports.handleValidationErrors = void 0;
const express_validator_1 = require("express-validator");
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            message: 'Invalid input data',
            details: errors.array().map(error => ({
                field: error.type === 'field' ? error.path : 'unknown',
                message: error.msg,
                value: error.type === 'field' ? error.value : undefined
            }))
        });
    }
    next();
};
exports.handleValidationErrors = handleValidationErrors;
exports.emailValidation = (0, express_validator_1.body)('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail();
exports.passwordValidation = (0, express_validator_1.body)('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number');
exports.nameValidation = (0, express_validator_1.body)('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, apostrophes, and periods');
exports.idParamValidation = (0, express_validator_1.param)('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer');
exports.productValidation = [
    (0, express_validator_1.body)('name')
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('Product name must be between 2 and 200 characters'),
    (0, express_validator_1.body)('brand')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Brand must be between 2 and 100 characters'),
    (0, express_validator_1.body)('model')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Model must be between 2 and 100 characters'),
    (0, express_validator_1.body)('sku')
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('SKU must be between 3 and 100 characters'),
    (0, express_validator_1.body)('price')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    (0, express_validator_1.body)('comparePrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Compare price must be a positive number'),
    (0, express_validator_1.body)('stock')
        .isInt({ min: 0 })
        .withMessage('Stock must be a non-negative integer'),
    (0, express_validator_1.body)('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must be less than 1000 characters'),
    (0, express_validator_1.body)('tireWidth')
        .optional()
        .isLength({ min: 2, max: 10 })
        .withMessage('Tire width must be between 2 and 10 characters'),
    (0, express_validator_1.body)('aspectRatio')
        .optional()
        .isLength({ min: 2, max: 10 })
        .withMessage('Aspect ratio must be between 2 and 10 characters'),
    (0, express_validator_1.body)('rimDiameter')
        .optional()
        .isLength({ min: 1, max: 10 })
        .withMessage('Rim diameter must be between 1 and 10 characters'),
    (0, express_validator_1.body)('size')
        .trim()
        .isLength({ min: 5, max: 50 })
        .withMessage('Size must be between 5 and 50 characters'),
    (0, express_validator_1.body)('loadIndex')
        .optional()
        .isLength({ min: 1, max: 10 })
        .withMessage('Load index must be between 1 and 10 characters'),
    (0, express_validator_1.body)('speedRating')
        .optional()
        .isLength({ min: 1, max: 5 })
        .withMessage('Speed rating must be between 1 and 5 characters'),
    (0, express_validator_1.body)('seasonType')
        .optional()
        .isIn(['summer', 'winter', 'all-season'])
        .withMessage('Season type must be summer, winter, or all-season'),
    (0, express_validator_1.body)('tireType')
        .optional()
        .isIn(['passenger', 'suv', 'truck', 'performance', 'commercial', 'touring', 'off-road', 'economy', 'luxury'])
        .withMessage('Tire type must be passenger, suv, truck, performance, commercial, touring, off-road, economy, or luxury'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['draft', 'published', 'hidden'])
        .withMessage('Status must be draft, published, or hidden'),
    (0, express_validator_1.body)('featured')
        .optional()
        .isBoolean()
        .withMessage('Featured must be true or false'),
    (0, express_validator_1.body)('lowStockThreshold')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Low stock threshold must be a non-negative integer')
];
exports.registerValidation = [
    exports.nameValidation,
    exports.emailValidation,
    exports.passwordValidation,
    (0, express_validator_1.body)('confirmPassword')
        .custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Password confirmation does not match password');
        }
        return true;
    })
];
exports.loginValidation = [
    exports.emailValidation,
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required')
];
exports.orderValidation = [
    (0, express_validator_1.body)('items')
        .isArray({ min: 1 })
        .withMessage('Order must contain at least one item'),
    (0, express_validator_1.body)('items.*.productId')
        .isInt({ min: 1 })
        .withMessage('Product ID must be a positive integer'),
    (0, express_validator_1.body)('items.*.quantity')
        .isInt({ min: 1 })
        .withMessage('Quantity must be a positive integer'),
    (0, express_validator_1.body)('shippingAddress')
        .isObject()
        .withMessage('Shipping address is required'),
    (0, express_validator_1.body)('shippingAddress.street')
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage('Street address must be between 5 and 200 characters'),
    (0, express_validator_1.body)('shippingAddress.city')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('City must be between 2 and 100 characters'),
    (0, express_validator_1.body)('shippingAddress.zipCode')
        .trim()
        .matches(/^[0-9A-Z\s\-]{3,20}$/i)
        .withMessage('Invalid postal code format'),
    (0, express_validator_1.body)('shippingAddress.country')
        .trim()
        .isLength({ min: 2, max: 2 })
        .withMessage('Country must be a 2-letter country code')
];
exports.paginationValidation = [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
    (0, express_validator_1.query)('sortBy')
        .optional()
        .isIn(['name', 'price', 'createdAt', 'updatedAt'])
        .withMessage('Invalid sort field'),
    (0, express_validator_1.query)('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc')
];
exports.searchValidation = [
    (0, express_validator_1.query)('q')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters')
        .trim()
        .escape(),
    (0, express_validator_1.query)('brand')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('Brand filter must be between 1 and 50 characters')
        .trim()
        .escape(),
    (0, express_validator_1.query)('category')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('Category filter must be between 1 and 50 characters')
        .trim()
        .escape(),
    (0, express_validator_1.query)('minPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum price must be a positive number'),
    (0, express_validator_1.query)('maxPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Maximum price must be a positive number')
];
exports.advancedSearchValidation = [
    ...exports.searchValidation,
    ...exports.paginationValidation,
    (0, express_validator_1.query)('inStock')
        .optional()
        .isBoolean()
        .withMessage('In stock filter must be true or false'),
    (0, express_validator_1.query)('featured')
        .optional()
        .isBoolean()
        .withMessage('Featured filter must be true or false')
];
const fileUploadValidation = (req, res, next) => {
    if (!req.file && !req.files) {
        return res.status(400).json({
            error: 'No file uploaded',
            message: 'Please select a file to upload'
        });
    }
    const file = req.file || (Array.isArray(req.files) ? req.files[0] : undefined);
    if (file && typeof file === 'object' && 'size' in file && 'mimetype' in file) {
        if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({
                error: 'File too large',
                message: 'File size must be less than 10MB'
            });
        }
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return res.status(400).json({
                error: 'Invalid file type',
                message: 'Only JPEG, PNG, WebP, and GIF images are allowed'
            });
        }
    }
    next();
};
exports.fileUploadValidation = fileUploadValidation;
const sanitizeHtml = (req, res, next) => {
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            return value
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
                .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }
        else if (typeof value === 'object' && value !== null) {
            const sanitized = Array.isArray(value) ? [] : {};
            for (const key in value) {
                sanitized[key] = sanitizeValue(value[key]);
            }
            return sanitized;
        }
        return value;
    };
    req.body = sanitizeValue(req.body);
    req.query = sanitizeValue(req.query);
    req.params = sanitizeValue(req.params);
    next();
};
exports.sanitizeHtml = sanitizeHtml;
