import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Handle validation errors
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
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

// Common validation rules
export const emailValidation = body('email')
  .isEmail()
  .withMessage('Must be a valid email address')
  .normalizeEmail();

export const passwordValidation = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number');

export const nameValidation = body('name')
  .trim()
  .isLength({ min: 2, max: 50 })
  .withMessage('Name must be between 2 and 50 characters')
  .matches(/^[a-zA-Z\s\-'\.]+$/)
  .withMessage('Name can only contain letters, spaces, hyphens, apostrophes, and periods');

// ID parameter validation
export const idParamValidation = param('id')
  .isInt({ min: 1 })
  .withMessage('ID must be a positive integer');

// Product validation
export const productValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Product name must be between 2 and 200 characters'),
  body('brand')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Brand must be between 2 and 100 characters'),
  body('model')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Model must be between 2 and 100 characters'),
  body('sku')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('SKU must be between 3 and 100 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('comparePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Compare price must be a positive number'),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be less than 5000 characters'),
  
  // Tire-specific validations
  body('tireWidth')
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage('Tire width must be between 2 and 10 characters'),
  body('aspectRatio')
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage('Aspect ratio must be between 2 and 10 characters'),
  body('rimDiameter')
    .optional()
    .isLength({ min: 1, max: 10 })
    .withMessage('Rim diameter must be between 1 and 10 characters'),
  body('size')
    .trim()
    .isLength({ min: 5, max: 50 })
    .withMessage('Size must be between 5 and 50 characters'),
  body('loadIndex')
    .optional()
    .isLength({ min: 1, max: 10 })
    .withMessage('Load index must be between 1 and 10 characters'),
  body('speedRating')
    .optional()
    .isLength({ min: 1, max: 5 })
    .withMessage('Speed rating must be between 1 and 5 characters'),
  body('seasonType')
    .optional()
    .isIn(['summer', 'winter', 'all-season'])
    .withMessage('Season type must be summer, winter, or all-season'),
  body('tireType')
    .optional()
    .isIn(['passenger', 'suv', 'truck', 'performance', 'commercial', 'touring', 'off-road', 'economy', 'luxury'])
    .withMessage('Tire type must be passenger, suv, truck, performance, commercial, touring, off-road, economy, or luxury'),
  
  body('status')
    .optional()
    .isIn(['draft', 'published', 'hidden'])
    .withMessage('Status must be draft, published, or hidden'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be true or false'),
  body('lowStockThreshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Low stock threshold must be a non-negative integer')
];

// User registration validation
export const registerValidation = [
  nameValidation,
  emailValidation,
  passwordValidation,
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    })
];

// User login validation
export const loginValidation = [
  emailValidation,
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Order validation
export const orderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('shippingAddress')
    .isObject()
    .withMessage('Shipping address is required'),
  body('shippingAddress.street')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Street address must be between 5 and 200 characters'),
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),
  body('shippingAddress.zipCode')
    .trim()
    .matches(/^[0-9A-Z\s\-]{3,20}$/i)
    .withMessage('Invalid postal code format'),
  body('shippingAddress.country')
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country must be a 2-letter country code')
];

// Query parameter validation
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  query('sortBy')
    .optional()
    .isIn(['name', 'price', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Search input validation
export const searchValidation = [
  query('q')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .trim()
    .escape(), // Escapes HTML characters to prevent XSS
  query('brand')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Brand filter must be between 1 and 50 characters')
    .trim()
    .escape(),
  query('category')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category filter must be between 1 and 50 characters')
    .trim()
    .escape(),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number')
];

// Advanced search validation (for complex search operations)
export const advancedSearchValidation = [
  ...searchValidation,
  ...paginationValidation,
  query('inStock')
    .optional()
    .isBoolean()
    .withMessage('In stock filter must be true or false'),
  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured filter must be true or false')
];

// File upload validation
export const fileUploadValidation = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      error: 'No file uploaded',
      message: 'Please select a file to upload'
    });
  }

  const file = req.file || (Array.isArray(req.files) ? req.files[0] : undefined);
  
  if (file && typeof file === 'object' && 'size' in file && 'mimetype' in file) {
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size must be less than 10MB'
      });
    }

    // Check file type for images
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

// Sanitize HTML input
export const sanitizeHtml = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potentially dangerous HTML tags and scripts
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
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
