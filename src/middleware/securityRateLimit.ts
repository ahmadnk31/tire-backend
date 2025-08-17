import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { eq, and, gte, sql } from 'drizzle-orm';

// Security attempt tracking table (add to schema later)
interface SecurityAttempt {
  id?: number;
  email: string;
  ipAddress: string;
  userAgent: string;
  attemptType: 'login_failed' | 'malicious_script' | 'rate_limit';
  attemptTime: Date;
  isBlocked: boolean;
  blockReason?: string;
  deviceInfo?: string;
}

// In-memory store for tracking attempts (in production, use Redis)
const attemptStore = new Map<string, SecurityAttempt[]>();

// Helper to get client info
const getClientInfo = (req: Request) => {
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const deviceInfo = {
    userAgent,
    acceptLanguage: req.get('Accept-Language'),
    acceptEncoding: req.get('Accept-Encoding'),
    referer: req.get('Referer'),
    origin: req.get('Origin')
  };
  
  return {
    ipAddress,
    userAgent,
    deviceInfo: JSON.stringify(deviceInfo)
  };
};

// Helper to create attempt key
const createAttemptKey = (email: string, ipAddress: string) => {
  return `${email}:${ipAddress}`;
};

// Check if email/IP combination is blocked
export const checkSecurityBlock = async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;
  if (!email) return next();

  const { ipAddress } = getClientInfo(req);
  const attemptKey = createAttemptKey(email, ipAddress);
  
  // Get attempts from store
  const attempts = attemptStore.get(attemptKey) || [];
  
  // Clean old attempts (older than 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentAttempts = attempts.filter(attempt => attempt.attemptTime > oneHourAgo);
  attemptStore.set(attemptKey, recentAttempts);
  
  // Check if blocked
  const isBlocked = recentAttempts.some(attempt => attempt.isBlocked);
  if (isBlocked) {
    const blockReason = recentAttempts.find(a => a.isBlocked)?.blockReason || 'Security violation';
    
    return res.status(429).json({
      error: 'Account temporarily blocked',
      message: `This email and IP combination has been temporarily blocked due to: ${blockReason}. Please contact support or try again later.`,
      blockReason,
      blockedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour block
      supportEmail: 'security@tirestore.com'
    });
  }
  
  next();
};

// Record failed login attempt
export const recordFailedAttempt = (email: string, req: Request, reason: string = 'Invalid credentials') => {
  const { ipAddress, userAgent, deviceInfo } = getClientInfo(req);
  const attemptKey = createAttemptKey(email, ipAddress);
  
  // Get existing attempts
  const attempts = attemptStore.get(attemptKey) || [];
  
  // Clean old attempts (older than 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentAttempts = attempts.filter(attempt => attempt.attemptTime > oneHourAgo);
  
  // Add new attempt
  const newAttempt: SecurityAttempt = {
    email,
    ipAddress,
    userAgent,
    attemptType: 'login_failed',
    attemptTime: new Date(),
    isBlocked: false,
    blockReason: reason,
    deviceInfo
  };
  
  recentAttempts.push(newAttempt);
  
  // Check if should block (3 failed attempts = warning, 6 failed attempts = block)
  const failedCount = recentAttempts.filter(a => a.attemptType === 'login_failed').length;
  
  if (failedCount >= 6) {
    // Block after 6 attempts
    newAttempt.isBlocked = true;
    newAttempt.blockReason = `Too many failed login attempts (${failedCount}). Potential brute force attack detected.`;
    
    console.warn(`🚨 SECURITY ALERT: Email ${email} blocked from IP ${ipAddress} after ${failedCount} failed attempts`);
    console.warn(`Device Info: ${deviceInfo}`);
    
    // Log to file or external service in production
    logSecurityIncident({
      level: 'CRITICAL',
      type: 'ACCOUNT_BLOCKED',
      email,
      ipAddress,
      userAgent,
      attemptCount: failedCount,
      deviceInfo,
      timestamp: new Date().toISOString()
    });
    
  } else if (failedCount >= 3) {
    // Warning after 3 attempts
    console.warn(`⚠️  SECURITY WARNING: Email ${email} from IP ${ipAddress} has ${failedCount} failed attempts`);
    
    logSecurityIncident({
      level: 'WARNING',
      type: 'MULTIPLE_FAILED_ATTEMPTS',
      email,
      ipAddress,
      userAgent,
      attemptCount: failedCount,
      deviceInfo,
      timestamp: new Date().toISOString()
    });
  }
  
  attemptStore.set(attemptKey, recentAttempts);
  
  return {
    failedCount,
    isWarning: failedCount >= 3 && failedCount < 6,
    isBlocked: failedCount >= 6,
    attemptsRemaining: Math.max(0, 6 - failedCount)
  };
};

// Record successful login (clear attempts)
export const recordSuccessfulLogin = (email: string, req: Request) => {
  const { ipAddress } = getClientInfo(req);
  const attemptKey = createAttemptKey(email, ipAddress);
  
  // Clear attempts for this email/IP combination
  attemptStore.delete(attemptKey);
  
  console.log(`✅ Successful login: ${email} from IP ${ipAddress}`);
};

// Detect malicious script attempts
export const detectMaliciousActivity = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  const { ipAddress, userAgent, deviceInfo } = getClientInfo(req);
  
  // Detect potential script/bot activity
  const suspiciousPatterns = [
    // No user agent or common bot patterns
    !userAgent || userAgent === 'unknown',
    userAgent.toLowerCase().includes('bot'),
    userAgent.toLowerCase().includes('crawler'),
    userAgent.toLowerCase().includes('spider'),
    
    // Suspicious password patterns
    password && (
      password.includes('<script>') ||
      password.includes('javascript:') ||
      password.includes('eval(') ||
      password.length > 200 ||
      /['"<>{}]/.test(password)
    ),
    
    // Suspicious email patterns
    email && (
      email.includes('<script>') ||
      email.includes('javascript:') ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ),
    
    // Missing common headers
    !req.get('Accept'),
    !req.get('Accept-Language'),
    
    // Unusual request patterns
    req.get('X-Requested-With') === 'XMLHttpRequest' && !req.get('Referer')
  ];
  
  const suspiciousScore = suspiciousPatterns.filter(Boolean).length;
  
  if (suspiciousScore >= 3) {
    // Record malicious attempt
    if (email) {
      const attemptKey = createAttemptKey(email, ipAddress);
      const attempts = attemptStore.get(attemptKey) || [];
      
      const maliciousAttempt: SecurityAttempt = {
        email,
        ipAddress,
        userAgent,
        attemptType: 'malicious_script',
        attemptTime: new Date(),
        isBlocked: true,
        blockReason: `Malicious script/bot activity detected (suspicion score: ${suspiciousScore})`,
        deviceInfo
      };
      
      attempts.push(maliciousAttempt);
      attemptStore.set(attemptKey, attempts);
      
      console.error(`🚨 SECURITY ALERT: Malicious activity detected for ${email} from IP ${ipAddress}`);
      console.error(`Suspicion Score: ${suspiciousScore}, User Agent: ${userAgent}`);
      
      logSecurityIncident({
        level: 'CRITICAL',
        type: 'MALICIOUS_ACTIVITY',
        email,
        ipAddress,
        userAgent,
        suspiciousScore,
        deviceInfo,
        timestamp: new Date().toISOString()
      });
      
      return res.status(429).json({
        error: 'Suspicious activity detected',
        message: 'Your request has been flagged as potentially malicious. Please contact support if this is an error.',
        suspicionScore: suspiciousScore,
        supportEmail: 'security@tirestore.com'
      });
    }
  }
  
  next();
};

// Enhanced login rate limiter
export const enhancedLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: Request) => {
    const { ipAddress } = getClientInfo(req);
    
    // Check if this IP has blocked accounts
    let hasBlockedAccounts = false;
    for (const [key, attempts] of attemptStore.entries()) {
      if (key.includes(ipAddress) && attempts.some(a => a.isBlocked)) {
        hasBlockedAccounts = true;
        break;
      }
    }
    
    // More restrictive limits for IPs with blocked accounts
    return hasBlockedAccounts ? 3 : 10;
  },
  message: (req: Request) => {
    const { ipAddress } = getClientInfo(req);
    
    logSecurityIncident({
      level: 'WARNING',
      type: 'RATE_LIMIT_EXCEEDED',
      ipAddress,
      userAgent: req.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString()
    });
    
    return {
      error: 'Too many login attempts',
      message: 'Too many login attempts from this IP address. Please try again later.',
      retryAfter: 15 * 60 // 15 minutes
    };
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const message = typeof res.locals.rateLimit?.message === 'object' 
      ? res.locals.rateLimit.message 
      : { error: 'Rate limit exceeded' };
    
    res.status(429).json(message);
  }
});

// Security incident logging (replace with proper logging service in production)
const logSecurityIncident = (incident: any) => {
  // In production, send to logging service like Winston, Datadog, etc.
  console.log(`[SECURITY LOG] ${incident.timestamp}: ${JSON.stringify(incident)}`);
  
  // Could also save to database, send alerts, etc.
  // await db.insert(securityLogs).values(incident);
};

// Middleware to check and warn users about remaining attempts
export const checkAttemptWarning = (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;
  if (!email) return next();
  
  const { ipAddress } = getClientInfo(req);
  const attemptKey = createAttemptKey(email, ipAddress);
  const attempts = attemptStore.get(attemptKey) || [];
  
  // Clean old attempts
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentAttempts = attempts.filter(attempt => attempt.attemptTime > oneHourAgo);
  
  const failedCount = recentAttempts.filter(a => a.attemptType === 'login_failed').length;
  
  if (failedCount >= 3 && failedCount < 6) {
    // Add warning to response
    (req as any).securityWarning = {
      failedAttempts: failedCount,
      attemptsRemaining: 6 - failedCount,
      message: `Warning: ${failedCount} failed login attempts detected. ${6 - failedCount} attempts remaining before account is temporarily blocked.`
    };
  }
  
  next();
};

// Get security status for an email/IP combination
export const getSecurityStatus = (email: string, req: Request) => {
  const { ipAddress } = getClientInfo(req);
  const attemptKey = createAttemptKey(email, ipAddress);
  const attempts = attemptStore.get(attemptKey) || [];
  
  // Clean old attempts
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentAttempts = attempts.filter(attempt => attempt.attemptTime > oneHourAgo);
  
  const failedCount = recentAttempts.filter(a => a.attemptType === 'login_failed').length;
  const isBlocked = recentAttempts.some(a => a.isBlocked);
  
  return {
    failedAttempts: failedCount,
    isBlocked,
    attemptsRemaining: Math.max(0, 6 - failedCount),
    recentAttempts: recentAttempts.length,
    nextAllowedTime: isBlocked ? new Date(Date.now() + 60 * 60 * 1000) : null
  };
};

// Clear security blocks for admin use
export const clearSecurityBlocks = (email?: string, ipAddress?: string) => {
  if (email && ipAddress) {
    // Clear specific email/IP combination
    const attemptKey = createAttemptKey(email, ipAddress);
    attemptStore.delete(attemptKey);
    return { cleared: 1, type: 'specific', email, ipAddress };
  } else if (email) {
    // Clear all blocks for this email across all IPs
    let clearedCount = 0;
    for (const [key, attempts] of attemptStore.entries()) {
      if (key.startsWith(`${email}:`)) {
        attemptStore.delete(key);
        clearedCount++;
      }
    }
    return { cleared: clearedCount, type: 'email', email };
  } else if (ipAddress) {
    // Clear all blocks for this IP across all emails
    let clearedCount = 0;
    for (const [key, attempts] of attemptStore.entries()) {
      if (key.endsWith(`:${ipAddress}`)) {
        attemptStore.delete(key);
        clearedCount++;
      }
    }
    return { cleared: clearedCount, type: 'ip', ipAddress };
  } else {
    // Clear all blocks (nuclear option)
    const totalBlocks = attemptStore.size;
    attemptStore.clear();
    return { cleared: totalBlocks, type: 'all' };
  }
};

// Get all current security blocks (admin use)
export const getAllSecurityBlocks = () => {
  const blocks: any[] = [];
  
  for (const [key, attempts] of attemptStore.entries()) {
    const [email, ipAddress] = key.split(':');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = attempts.filter(attempt => attempt.attemptTime > oneHourAgo);
    
    if (recentAttempts.length > 0) {
      const failedCount = recentAttempts.filter(a => a.attemptType === 'login_failed').length;
      const isBlocked = recentAttempts.some(a => a.isBlocked);
      const lastAttempt = recentAttempts[recentAttempts.length - 1];
      
      blocks.push({
        email,
        ipAddress,
        failedAttempts: failedCount,
        totalAttempts: recentAttempts.length,
        isBlocked,
        lastAttempt: lastAttempt.attemptTime,
        lastAttemptType: lastAttempt.attemptType,
        blockReason: lastAttempt.blockReason,
        userAgent: lastAttempt.userAgent
      });
    }
  }
  
  return blocks.sort((a, b) => new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime());
};
