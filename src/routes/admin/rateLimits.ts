import express from 'express';
import { db } from '../../db';
import { systemSettings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../../middleware/auth';
// import { refreshRateLimiters } from '../../middleware/dynamicRateLimiting';

const router = express.Router();

// Get all rate limit settings
router.get('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const settings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.category, 'rate_limits'));

    // Convert to key-value pairs
    const rateLimitSettings = settings.reduce((acc, setting) => {
      acc[setting.key] = JSON.parse(setting.value);
      return acc;
    }, {} as Record<string, any>);

    res.json({
      success: true,
      data: rateLimitSettings
    });
  } catch (error) {
    console.error('Error fetching rate limit settings:', error);
    res.status(500).json({ error: 'Failed to fetch rate limit settings' });
  }
});

// Update rate limit settings
router.put('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = (req as any).user.id;

    // Validate settings
    const validSettings = {
      general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200,
        message: 'Too many API requests from this IP, please try again later.'
      },
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10,
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

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      if (validSettings[key as keyof typeof validSettings]) {
        await db
          .insert(systemSettings)
          .values({
            key: `rate_limit_${key}`,
            value: JSON.stringify(value),
            description: `Rate limit settings for ${key}`,
            category: 'rate_limits',
            updatedBy: userId
          })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
              value: JSON.stringify(value),
              updatedBy: userId,
              updatedAt: new Date()
            }
          });
      }
    }

    // Refresh the rate limiters cache to apply new settings immediately
    // refreshRateLimiters();
    
    res.json({
      success: true,
      message: 'Rate limit settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating rate limit settings:', error);
    res.status(500).json({ error: 'Failed to update rate limit settings' });
  }
});

// In-memory rate limit statistics tracking
const rateLimitStats = {
  totalRequests: 0,
  blockedRequests: 0,
  ipBlockCounts: new Map<string, number>(),
  rateLimitHits: {
    general: 0,
    auth: 0,
    payment: 0,
    upload: 0
  },
  last24Hours: {
    requests: 0,
    blocked: 0,
    uniqueIPs: new Set<string>()
  },
  lastReset: new Date()
};

// Function to track rate limit hits
export const trackRateLimitHit = (type: 'general' | 'auth' | 'payment' | 'upload', ip: string) => {
  rateLimitStats.totalRequests++;
  rateLimitStats.blockedRequests++;
  rateLimitStats.rateLimitHits[type]++;
  
  // Track IP block count
  const currentCount = rateLimitStats.ipBlockCounts.get(ip) || 0;
  rateLimitStats.ipBlockCounts.set(ip, currentCount + 1);
  
  // Track last 24 hours
  const now = new Date();
  const hoursSinceReset = (now.getTime() - rateLimitStats.lastReset.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceReset >= 24) {
    // Reset 24-hour stats
    rateLimitStats.last24Hours = {
      requests: 0,
      blocked: 0,
      uniqueIPs: new Set<string>()
    };
    rateLimitStats.lastReset = now;
  }
  
  rateLimitStats.last24Hours.requests++;
  rateLimitStats.last24Hours.blocked++;
  rateLimitStats.last24Hours.uniqueIPs.add(ip);
};

// Function to track successful requests
export const trackSuccessfulRequest = (ip: string) => {
  rateLimitStats.totalRequests++;
  
  // Track last 24 hours
  const now = new Date();
  const hoursSinceReset = (now.getTime() - rateLimitStats.lastReset.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceReset >= 24) {
    // Reset 24-hour stats
    rateLimitStats.last24Hours = {
      requests: 0,
      blocked: 0,
      uniqueIPs: new Set<string>()
    };
    rateLimitStats.lastReset = now;
  }
  
  rateLimitStats.last24Hours.requests++;
  rateLimitStats.last24Hours.uniqueIPs.add(ip);
};

// Get rate limit statistics
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Convert Map and Set to serializable format
    const topBlockedIPs = Array.from(rateLimitStats.ipBlockCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 blocked IPs

    const stats = {
      totalRequests: rateLimitStats.totalRequests,
      blockedRequests: rateLimitStats.blockedRequests,
      topBlockedIPs,
      rateLimitHits: rateLimitStats.rateLimitHits,
      last24Hours: {
        requests: rateLimitStats.last24Hours.requests,
        blocked: rateLimitStats.last24Hours.blocked,
        uniqueIPs: rateLimitStats.last24Hours.uniqueIPs.size
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching rate limit stats:', error);
    res.status(500).json({ error: 'Failed to fetch rate limit statistics' });
  }
});

// Reset rate limit counters (for testing)
router.post('/reset', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Reset all statistics
    rateLimitStats.totalRequests = 0;
    rateLimitStats.blockedRequests = 0;
    rateLimitStats.ipBlockCounts.clear();
    rateLimitStats.rateLimitHits = {
      general: 0,
      auth: 0,
      payment: 0,
      upload: 0
    };
    rateLimitStats.last24Hours = {
      requests: 0,
      blocked: 0,
      uniqueIPs: new Set<string>()
    };
    rateLimitStats.lastReset = new Date();
    
    // Refresh the rate limiters cache
    // refreshRateLimiters();
    
    res.json({
      success: true,
      message: 'Rate limit counters reset successfully'
    });
  } catch (error) {
    console.error('Error resetting rate limit counters:', error);
    res.status(500).json({ error: 'Failed to reset rate limit counters' });
  }
});

export default router;
