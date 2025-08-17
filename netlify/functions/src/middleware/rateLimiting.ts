import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';

// Rate limiting middleware
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// General API rate limit
export const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  process.env.NODE_ENV === 'development' ? 1000 : 200, // 1000 requests in dev, 200 in prod
  'Too many API requests from this IP, please try again later.'
);

// Strict rate limit for auth endpoints
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  process.env.NODE_ENV === 'development' ? 50 : 10, // 50 attempts in dev, 10 in prod
  'Too many authentication attempts, please try again later.'
);

// Rate limit for payment endpoints
export const paymentRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  10, // 10 payment attempts per window
  'Too many payment attempts, please try again later.'
);

// Rate limit for file uploads
export const uploadRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  20, // 20 uploads per window
  'Too many upload attempts, please try again later.'
);

// Slow down middleware for repeated requests
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per window without delay
  delayMs: () => 500, // add 500ms delay per request after delayAfter (new format)
  maxDelayMs: 20000, // max delay of 20 seconds
});

// Request size limiter
export const requestSizeLimiter = (maxSize: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('content-length');
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      const maxSizeInMB = parseInt(maxSize.replace('mb', ''));
      
      if (sizeInMB > maxSizeInMB) {
        return res.status(413).json({
          error: 'Request too large',
          message: `Request size exceeds ${maxSize} limit`,
          maxSize: maxSize
        });
      }
    }
    next();
  };
};
