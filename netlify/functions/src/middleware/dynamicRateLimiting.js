"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicSpeedLimiter = exports.dynamicUploadRateLimit = exports.dynamicPaymentRateLimit = exports.dynamicAuthRateLimit = exports.dynamicGeneralRateLimit = exports.refreshRateLimiters = exports.createDynamicRateLimitMiddleware = void 0;
const rateLimiting_1 = require("./rateLimiting");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const rateLimits_1 = require("../routes/admin/rateLimits");
let dynamicRateLimiters = {};
let lastUpdate = 0;
const UPDATE_INTERVAL = 5 * 60 * 1000;
async function getRateLimitSettings() {
    try {
        const settings = await db_1.db
            .select()
            .from(schema_1.systemSettings)
            .where((0, drizzle_orm_1.eq)(schema_1.systemSettings.category, 'rate_limits'));
        return settings.reduce((acc, setting) => {
            const key = setting.key.replace('rate_limit_', '');
            acc[key] = JSON.parse(setting.value);
            return acc;
        }, {});
    }
    catch (error) {
        console.error('Error fetching rate limit settings:', error);
        return {
            general: { windowMs: 15 * 60 * 1000, max: 200, message: 'Too many API requests from this IP, please try again later.' },
            auth: { windowMs: 15 * 60 * 1000, max: 10, message: 'Too many authentication attempts, please try again later.' },
            payment: { windowMs: 15 * 60 * 1000, max: 10, message: 'Too many payment attempts, please try again later.' },
            upload: { windowMs: 15 * 60 * 1000, max: 20, message: 'Too many upload attempts, please try again later.' },
            speedLimit: { windowMs: 15 * 60 * 1000, delayAfter: 50, delayMs: 500, maxDelayMs: 20000 }
        };
    }
}
async function createDynamicRateLimiters() {
    const now = Date.now();
    if (now - lastUpdate < UPDATE_INTERVAL && Object.keys(dynamicRateLimiters).length > 0) {
        return dynamicRateLimiters;
    }
    try {
        const settings = await getRateLimitSettings();
        dynamicRateLimiters.general = (0, express_rate_limit_1.default)({
            windowMs: settings.general?.windowMs || 15 * 60 * 1000,
            max: settings.general?.max || 200,
            message: settings.general?.message || 'Too many API requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
                (0, rateLimits_1.trackRateLimitHit)('general', clientIP);
                res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: settings.general?.message || 'Too many requests from this IP, please try again later.',
                    retryAfter: Math.round((settings.general?.windowMs || 15 * 60 * 1000) / 1000)
                });
            },
            skipSuccessfulRequests: false
        });
        dynamicRateLimiters.auth = (0, express_rate_limit_1.default)({
            windowMs: settings.auth?.windowMs || 15 * 60 * 1000,
            max: settings.auth?.max || 10,
            message: settings.auth?.message || 'Too many authentication attempts, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
                (0, rateLimits_1.trackRateLimitHit)('auth', clientIP);
                res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: settings.auth?.message || 'Too many authentication attempts, please try again later.',
                    retryAfter: Math.round((settings.auth?.windowMs || 15 * 60 * 1000) / 1000)
                });
            },
            skipSuccessfulRequests: false
        });
        dynamicRateLimiters.payment = (0, express_rate_limit_1.default)({
            windowMs: settings.payment?.windowMs || 15 * 60 * 1000,
            max: settings.payment?.max || 10,
            message: settings.payment?.message || 'Too many payment attempts, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
                (0, rateLimits_1.trackRateLimitHit)('payment', clientIP);
                res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: settings.payment?.message || 'Too many payment attempts, please try again later.',
                    retryAfter: Math.round((settings.payment?.windowMs || 15 * 60 * 1000) / 1000)
                });
            }
        });
        dynamicRateLimiters.upload = (0, express_rate_limit_1.default)({
            windowMs: settings.upload?.windowMs || 15 * 60 * 1000,
            max: settings.upload?.max || 20,
            message: settings.upload?.message || 'Too many upload attempts, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
                (0, rateLimits_1.trackRateLimitHit)('upload', clientIP);
                res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: settings.upload?.message || 'Too many upload attempts, please try again later.',
                    retryAfter: Math.round((settings.upload?.windowMs || 15 * 60 * 1000) / 1000)
                });
            },
            skipSuccessfulRequests: false
        });
        dynamicRateLimiters.speedLimiter = (0, express_slow_down_1.default)({
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
    }
    catch (error) {
        console.error('Error creating dynamic rate limiters:', error);
        return dynamicRateLimiters;
    }
}
const createDynamicRateLimitMiddleware = (type) => {
    return async (req, res, next) => {
        try {
            const limiters = await createDynamicRateLimiters();
            const limiterKey = type === 'speed' ? 'speedLimiter' : type;
            const limiter = limiters[limiterKey];
            if (limiter) {
                const originalSend = res.send;
                res.send = function (data) {
                    if (res.statusCode < 400) {
                        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
                        (0, rateLimits_1.trackSuccessfulRequest)(clientIP);
                    }
                    return originalSend.call(this, data);
                };
                return limiter(req, res, next);
            }
            else {
                next();
            }
        }
        catch (error) {
            console.error(`Error in dynamic rate limiting (${type}):`, error);
            next();
        }
    };
};
exports.createDynamicRateLimitMiddleware = createDynamicRateLimitMiddleware;
const refreshRateLimiters = () => {
    dynamicRateLimiters = {};
    lastUpdate = 0;
    (0, rateLimiting_1.clearRateLimitCache)();
    console.log('🔄 Rate limiters cache cleared');
};
exports.refreshRateLimiters = refreshRateLimiters;
exports.dynamicGeneralRateLimit = (0, exports.createDynamicRateLimitMiddleware)('general');
exports.dynamicAuthRateLimit = (0, exports.createDynamicRateLimitMiddleware)('auth');
exports.dynamicPaymentRateLimit = (0, exports.createDynamicRateLimitMiddleware)('payment');
exports.dynamicUploadRateLimit = (0, exports.createDynamicRateLimitMiddleware)('upload');
exports.dynamicSpeedLimiter = (0, exports.createDynamicRateLimitMiddleware)('speed');
