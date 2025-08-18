"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestSizeLimiter = exports.speedLimiter = exports.uploadRateLimit = exports.paymentRateLimit = exports.authRateLimit = exports.generalRateLimit = exports.createRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
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
