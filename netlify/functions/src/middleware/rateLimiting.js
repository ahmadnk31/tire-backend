"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearRateLimitCache = exports.requestSizeLimiter = exports.speedLimiter = exports.uploadRateLimit = exports.paymentRateLimit = exports.authRateLimit = exports.generalRateLimit = exports.createDynamicSpeedLimiter = exports.createDynamicRateLimit = exports.createRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
let rateLimitCache = {};
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000;
async function getRateLimitSettings() {
    const now = Date.now();
    if (now < cacheExpiry && Object.keys(rateLimitCache).length > 0) {
        return rateLimitCache;
    }
    try {
        const settings = await db_1.db
            .select()
            .from(schema_1.systemSettings)
            .where((0, drizzle_orm_1.eq)(schema_1.systemSettings.category, 'rate_limits'));
        rateLimitCache = settings.reduce((acc, setting) => {
            const key = setting.key.replace('rate_limit_', '');
            acc[key] = JSON.parse(setting.value);
            return acc;
        }, {});
        cacheExpiry = now + CACHE_DURATION;
        return rateLimitCache;
    }
    catch (error) {
        console.error('Error fetching rate limit settings:', error);
        return getDefaultSettings();
    }
}
function getDefaultSettings() {
    return {
        general: {
            windowMs: 15 * 60 * 1000,
            max: process.env.NODE_ENV === 'development' ? 1000 : 200,
            message: 'Too many API requests from this IP, please try again later.'
        },
        auth: {
            windowMs: 15 * 60 * 1000,
            max: process.env.NODE_ENV === 'development' ? 50 : 10,
            message: 'Too many authentication attempts, please try again later.'
        },
        payment: {
            windowMs: 15 * 60 * 1000,
            max: 10,
            message: 'Too many payment attempts, please try again later.'
        },
        upload: {
            windowMs: 15 * 60 * 1000,
            max: 20,
            message: 'Too many upload attempts, please try again later.'
        },
        speedLimit: {
            windowMs: 15 * 60 * 1000,
            delayAfter: 50,
            delayMs: 500,
            maxDelayMs: 20000
        }
    };
}
const createRateLimit = (windowMs, max, message) => {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        message: message || 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'Too many requests from this IP, please try again later.',
                retryAfter: Math.round(windowMs / 1000)
            });
        }
    });
};
exports.createRateLimit = createRateLimit;
const createDynamicRateLimit = async (type) => {
    const settings = await getRateLimitSettings();
    const config = settings[type] || getDefaultSettings()[type];
    return (0, exports.createRateLimit)(config.windowMs, config.max, config.message);
};
exports.createDynamicRateLimit = createDynamicRateLimit;
const createDynamicSpeedLimiter = async () => {
    const settings = await getRateLimitSettings();
    const config = settings.speedLimit || getDefaultSettings().speedLimit;
    return (0, express_slow_down_1.default)({
        windowMs: config.windowMs,
        delayAfter: config.delayAfter,
        delayMs: () => config.delayMs,
        maxDelayMs: config.maxDelayMs,
    });
};
exports.createDynamicSpeedLimiter = createDynamicSpeedLimiter;
exports.generalRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, process.env.NODE_ENV === 'development' ? 1000 : 200, 'Too many API requests from this IP, please try again later.');
exports.authRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, process.env.NODE_ENV === 'development' ? 50 : 10, 'Too many authentication attempts, please try again later.');
exports.paymentRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, 10, 'Too many payment attempts, please try again later.');
exports.uploadRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, 20, 'Too many upload attempts, please try again later.');
exports.speedLimiter = (0, express_slow_down_1.default)({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: () => 500,
    maxDelayMs: 20000,
});
const requestSizeLimiter = (maxSize) => {
    return (req, res, next) => {
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
exports.requestSizeLimiter = requestSizeLimiter;
const clearRateLimitCache = () => {
    rateLimitCache = {};
    cacheExpiry = 0;
};
exports.clearRateLimitCache = clearRateLimitCache;
