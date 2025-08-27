import { db } from '../src/db';
import { systemSettings } from '../src/db/schema';

const defaultRateLimitSettings = {
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

async function initializeRateLimits() {
  try {
    console.log('🚀 Initializing rate limit settings...');
    
    for (const [key, value] of Object.entries(defaultRateLimitSettings)) {
      await db
        .insert(systemSettings)
        .values({
          key: `rate_limit_${key}`,
          value: JSON.stringify(value),
          description: `Rate limit settings for ${key}`,
          category: 'rate_limits',
          updatedBy: 1 // Assuming admin user ID is 1
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: JSON.stringify(value),
            updatedAt: new Date()
          }
        });
      
      console.log(`✅ Initialized rate limit settings for: ${key}`);
    }
    
    console.log('🎉 Rate limit settings initialization completed!');
  } catch (error) {
    console.error('❌ Error initializing rate limit settings:', error);
  } finally {
    process.exit(0);
  }
}

initializeRateLimits();
