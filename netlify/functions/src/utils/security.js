"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTOTP = exports.generateTOTP = exports.isValidUrl = exports.sanitizeInput = exports.maskSensitiveData = exports.getSecurityHeaders = exports.getCSPHeaders = exports.isValidApiKey = exports.generateApiKey = exports.getClientIP = exports.verifyHash = exports.hashData = exports.generateSecureToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const generateSecureToken = (length = 32) => {
    return crypto_1.default.randomBytes(length).toString('hex');
};
exports.generateSecureToken = generateSecureToken;
const hashData = (data, salt) => {
    const actualSalt = salt || crypto_1.default.randomBytes(16).toString('hex');
    const hash = crypto_1.default.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512');
    return `${actualSalt}:${hash.toString('hex')}`;
};
exports.hashData = hashData;
const verifyHash = (data, hash) => {
    const [salt, originalHash] = hash.split(':');
    const verifyHash = crypto_1.default.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
    return originalHash === verifyHash.toString('hex');
};
exports.verifyHash = verifyHash;
const getClientIP = (req) => {
    return (req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        'unknown');
};
exports.getClientIP = getClientIP;
const generateApiKey = () => {
    const timestamp = Date.now().toString();
    const random = crypto_1.default.randomBytes(16).toString('hex');
    return `ak_${Buffer.from(`${timestamp}-${random}`).toString('base64')}`;
};
exports.generateApiKey = generateApiKey;
const isValidApiKey = (apiKey) => {
    const apiKeyRegex = /^ak_[A-Za-z0-9+/]+=*$/;
    return apiKeyRegex.test(apiKey);
};
exports.isValidApiKey = isValidApiKey;
const getCSPHeaders = () => {
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
exports.getCSPHeaders = getCSPHeaders;
const getSecurityHeaders = () => {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        ...(0, exports.getCSPHeaders)()
    };
};
exports.getSecurityHeaders = getSecurityHeaders;
const maskSensitiveData = (data) => {
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
    for (const key in masked) {
        if (typeof masked[key] === 'object' && masked[key] !== null) {
            masked[key] = (0, exports.maskSensitiveData)(masked[key]);
        }
    }
    return masked;
};
exports.maskSensitiveData = maskSensitiveData;
const sanitizeInput = (input) => {
    return input
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
};
exports.sanitizeInput = sanitizeInput;
const isValidUrl = (url) => {
    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    }
    catch {
        return false;
    }
};
exports.isValidUrl = isValidUrl;
const generateTOTP = (secret, window = 0) => {
    const time = Math.floor(Date.now() / 1000 / 30) + window;
    const timeHex = time.toString(16).padStart(16, '0');
    const timeBytes = Buffer.from(timeHex, 'hex');
    const hmac = crypto_1.default.createHmac('sha1', secret);
    hmac.update(timeBytes);
    const digest = hmac.digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const code = ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);
    return (code % 1000000).toString().padStart(6, '0');
};
exports.generateTOTP = generateTOTP;
const verifyTOTP = (token, secret, window = 1) => {
    for (let i = -window; i <= window; i++) {
        if ((0, exports.generateTOTP)(secret, i) === token) {
            return true;
        }
    }
    return false;
};
exports.verifyTOTP = verifyTOTP;
