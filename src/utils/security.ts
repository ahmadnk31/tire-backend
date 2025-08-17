import crypto from 'crypto';
import { Request } from 'express';

// Generate secure random tokens
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Hash sensitive data
export const hashData = (data: string, salt?: string): string => {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512');
  return `${actualSalt}:${hash.toString('hex')}`;
};

// Verify hashed data
export const verifyHash = (data: string, hash: string): boolean => {
  const [salt, originalHash] = hash.split(':');
  const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
  return originalHash === verifyHash.toString('hex');
};

// Get client IP address
export const getClientIP = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Generate API keys
export const generateApiKey = (): string => {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  return `ak_${Buffer.from(`${timestamp}-${random}`).toString('base64')}`;
};

// Validate API key format
export const isValidApiKey = (apiKey: string): boolean => {
  const apiKeyRegex = /^ak_[A-Za-z0-9+/]+=*$/;
  return apiKeyRegex.test(apiKey);
};

// Content Security Policy headers
export const getCSPHeaders = () => {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  };
};

// Security headers
export const getSecurityHeaders = () => {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    ...getCSPHeaders()
  };
};

// Mask sensitive data for logging
export const maskSensitiveData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = [
    'password', 'token', 'apiKey', 'secret', 'credit_card', 
    'creditCard', 'ssn', 'email', 'phone', 'address'
  ];

  const masked = { ...data };
  
  for (const field of sensitiveFields) {
    if (field in masked) {
      if (typeof masked[field] === 'string') {
        masked[field] = masked[field].length > 4 
          ? `${masked[field].substring(0, 2)}***${masked[field].substring(masked[field].length - 2)}`
          : '***';
      }
    }
  }

  // Recursively mask nested objects
  for (const key in masked) {
    if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
};

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

// Validate URL format
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

// Time-based one-time password (for 2FA)
export const generateTOTP = (secret: string, window: number = 0): string => {
  const time = Math.floor(Date.now() / 1000 / 30) + window;
  const timeHex = time.toString(16).padStart(16, '0');
  const timeBytes = Buffer.from(timeHex, 'hex');
  
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(timeBytes);
  const digest = hmac.digest();
  
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24) |
               ((digest[offset + 1] & 0xff) << 16) |
               ((digest[offset + 2] & 0xff) << 8) |
               (digest[offset + 3] & 0xff);
  
  return (code % 1000000).toString().padStart(6, '0');
};

// Verify TOTP
export const verifyTOTP = (token: string, secret: string, window: number = 1): boolean => {
  for (let i = -window; i <= window; i++) {
    if (generateTOTP(secret, i) === token) {
      return true;
    }
  }
  return false;
};
