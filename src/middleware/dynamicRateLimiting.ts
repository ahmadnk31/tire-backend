import { Request, Response, NextFunction } from 'express';
import { clearRateLimitCache } from './rateLimiting';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { db } from '../db';
import { systemSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { trackRateLimitHit, trackSuccessfulRequest } from '../routes/admin/rateLimits';

// Cache for dynamic rate limiters
let dynamicRateLimiters: {
  general?: any;
  auth?: any;
  payment?: any;
  upload?: any;
  speedLimiter?: any;
} = {};

let lastUpdate = 0;
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Get rate limit settings from database
async function getRateLimitSettings() {
  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.category, 'rate_limits'));

    // Convert to key-value pairs
    return settings.reduce((acc, setting) => {
      const key = setting.key.replace('rate_limit_', '');
      acc[key] = JSON.parse(setting.value);
      return acc;
    }, {} as Record<string, any>);
  } catch (error) {
    console.error('Error fetching rate limit settings:', error);
    // Return default settings if database fails
    return {
      general: { windowMs: 15 * 60 * 1000, max: 200, message: 'Too many API requests from this IP, please try again later.' },
      auth: { windowMs: 15 * 60 * 1000, max: 10, message: 'Too many authentication attempts, please try again later.' },
      payment: { windowMs: 15 * 60 * 1000, max: 10, message: 'Too many payment attempts, please try again later.' },
      upload: { windowMs: 15 * 60 * 1000, max: 20, message: 'Too many upload attempts, please try again later.' },
      speedLimit: { windowMs: 15 * 60 * 1000, delayAfter: 50, delayMs: 500, maxDelayMs: 20000 }
    };
  }
}

// Create dynamic rate limiters
async function createDynamicRateLimiters() {
  const now = Date.now();
  
  // Only update if enough time has passed
  if (now - lastUpdate < UPDATE_INTERVAL && Object.keys(dynamicRateLimiters).length > 0) {
    return dynamicRateLimiters;
  }

  try {
    const settings = await getRateLimitSettings();
    
    // Create general rate limiter
    dynamicRateLimiters.general = rateLimit({
      windowMs: settings.general?.windowMs || 15 * 60 * 1000,
      max: settings.general?.max || 200,
      message: settings.general?.message || 'Too many API requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        // Track rate limit hit
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        trackRateLimitHit('general', clientIP);
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: settings.general?.message || 'Too many requests from this IP, please try again later.',
          retryAfter: Math.round((settings.general?.windowMs || 15 * 60 * 1000) / 1000)
        });
      },
      skipSuccessfulRequests: false
    });

    // Create auth rate limiter
    dynamicRateLimiters.auth = rateLimit({
      windowMs: settings.auth?.windowMs || 15 * 60 * 1000,
      max: settings.auth?.max || 10,
      message: settings.auth?.message || 'Too many authentication attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        // Track rate limit hit
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        trackRateLimitHit('auth', clientIP);
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: settings.auth?.message || 'Too many authentication attempts, please try again later.',
          retryAfter: Math.round((settings.auth?.windowMs || 15 * 60 * 1000) / 1000)
        });
      },
      skipSuccessfulRequests: false
    });

    // Create payment rate limiter
    dynamicRateLimiters.payment = rateLimit({
      windowMs: settings.payment?.windowMs || 15 * 60 * 1000,
      max: settings.payment?.max || 10,
      message: settings.payment?.message || 'Too many payment attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        // Track rate limit hit
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        trackRateLimitHit('payment', clientIP);
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: settings.payment?.message || 'Too many payment attempts, please try again later.',
          retryAfter: Math.round((settings.payment?.windowMs || 15 * 60 * 1000) / 1000)
        });
      }
    });

    // Create upload rate limiter
    dynamicRateLimiters.upload = rateLimit({
      windowMs: settings.upload?.windowMs || 15 * 60 * 1000,
      max: settings.upload?.max || 20,
      message: settings.upload?.message || 'Too many upload attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        // Track rate limit hit
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        trackRateLimitHit('upload', clientIP);
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: settings.upload?.message || 'Too many upload attempts, please try again later.',
          retryAfter: Math.round((settings.upload?.windowMs || 15 * 60 * 1000) / 1000)
        });
      },
      skipSuccessfulRequests: false
    });

    // Create speed limiter
    dynamicRateLimiters.speedLimiter = slowDown({
      windowMs: settings.speedLimit?.windowMs || 15 * 60 * 1000,
      delayAfter: settings.speedLimit?.delayAfter || 50,
      delayMs: () => settings.speedLimit?.delayMs || 500,
      maxDelayMs: settings.speedLimit?.maxDelayMs || 20000,
    });

    lastUpdate = now;
    console.log('🔄 Dynamic rate limiters updated with database settings:', {
      general: { max: settings.general?.max, windowMs: settings.general?.windowMs },
      auth: { max: settings.auth?.max, windowMs: settings.auth?.windowMs },
      payment: { max: settings.payment?.max, windowMs: settings.payment?.windowMs },
      upload: { max: settings.upload?.max, windowMs: settings.upload?.windowMs }
    });
    
    return dynamicRateLimiters;
  } catch (error) {
    console.error('Error creating dynamic rate limiters:', error);
    // Return existing limiters or create fallback ones
    return dynamicRateLimiters;
  }
}

// Middleware factory for dynamic rate limiting
export const createDynamicRateLimitMiddleware = (type: 'general' | 'auth' | 'payment' | 'upload' | 'speed') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limiters = await createDynamicRateLimiters();
      const limiterKey = type === 'speed' ? 'speedLimiter' : type;
      const limiter = limiters[limiterKey as keyof typeof limiters];
      
      if (limiter) {
        // Track successful requests after rate limiting passes
        const originalSend = res.send;
        res.send = function(data) {
          if (res.statusCode < 400) {
            const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
            trackSuccessfulRequest(clientIP);
          }
          return originalSend.call(this, data);
        };
        
        return limiter(req, res, next);
      } else {
        // Fallback to static rate limiting
        next();
      }
    } catch (error) {
      console.error(`Error in dynamic rate limiting (${type}):`, error);
      // Continue without rate limiting if there's an error
      next();
    }
  };
};

// Force refresh rate limiters (for admin use)
export const refreshRateLimiters = () => {
  dynamicRateLimiters = {};
  lastUpdate = 0;
  clearRateLimitCache();
  console.log('🔄 Rate limiters cache cleared');
};

// Export individual dynamic rate limiters
export const dynamicGeneralRateLimit = createDynamicRateLimitMiddleware('general');
export const dynamicAuthRateLimit = createDynamicRateLimitMiddleware('auth');
export const dynamicPaymentRateLimit = createDynamicRateLimitMiddleware('payment');
export const dynamicUploadRateLimit = createDynamicRateLimitMiddleware('upload');
export const dynamicSpeedLimiter = createDynamicRateLimitMiddleware('speed');
