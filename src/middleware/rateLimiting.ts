import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { systemSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

// Cache for rate limit settings
let rateLimitCache: Record<string, any> = {};
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get rate limit settings from database
async function getRateLimitSettings() {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (now < cacheExpiry && Object.keys(rateLimitCache).length > 0) {
    return rateLimitCache;
  }

  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.category, 'rate_limits'));

    // Convert to key-value pairs
    rateLimitCache = settings.reduce((acc, setting) => {
      const key = setting.key.replace('rate_limit_', '');
      acc[key] = JSON.parse(setting.value);
      return acc;
    }, {} as Record<string, any>);

    // Set cache expiry
    cacheExpiry = now + CACHE_DURATION;

    return rateLimitCache;
  } catch (error) {
    console.error('Error fetching rate limit settings:', error);
    // Return default settings if database fails
    return getDefaultSettings();
  }
}

// Default rate limit settings
function getDefaultSettings() {
  return {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'development' ? 1000 : 200,
      message: 'Too many API requests from this IP, please try again later.'
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'development' ? 50 : 10,
      message: 'Too many authentication attempts, please try again later.'
    },
    payment: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10,
      message: 'Too many payment attempts, please try again later.'
    },
    upload: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20,
      message: 'Too many upload attempts, please try again later.'
    },
    speedLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 50,
      delayMs: 500,
      maxDelayMs: 20000
    }
  };
}

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

// Dynamic rate limit creators
export const createDynamicRateLimit = async (type: 'general' | 'auth' | 'payment' | 'upload') => {
  const settings = await getRateLimitSettings();
  const config = settings[type] || getDefaultSettings()[type];
  
  return createRateLimit(
    config.windowMs,
    config.max,
    config.message
  );
};

// Dynamic speed limiter
export const createDynamicSpeedLimiter = async () => {
  const settings = await getRateLimitSettings();
  const config = settings.speedLimit || getDefaultSettings().speedLimit;
  
  return slowDown({
    windowMs: config.windowMs,
    delayAfter: config.delayAfter,
    delayMs: () => config.delayMs,
    maxDelayMs: config.maxDelayMs,
  });
};

// Static rate limiters (for backward compatibility)
export const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  process.env.NODE_ENV === 'development' ? 1000 : 200, // 1000 requests in dev, 200 in prod
  'Too many API requests from this IP, please try again later.'
);

export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  process.env.NODE_ENV === 'development' ? 50 : 10, // 50 attempts in dev, 10 in prod
  'Too many authentication attempts, please try again later.'
);

export const paymentRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  10, // 10 payment attempts per window
  'Too many payment attempts, please try again later.'
);

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

// Clear rate limit cache (for admin use)
export const clearRateLimitCache = () => {
  rateLimitCache = {};
  cacheExpiry = 0;
};
