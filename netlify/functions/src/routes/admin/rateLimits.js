"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackSuccessfulRequest = exports.trackRateLimitHit = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../../db");
const schema_1 = require("../../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../../middleware/auth");
const router = express_1.default.Router();
router.get('/settings', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const settings = await db_1.db
            .select()
            .from(schema_1.systemSettings)
            .where((0, drizzle_orm_1.eq)(schema_1.systemSettings.category, 'rate_limits'));
        const rateLimitSettings = settings.reduce((acc, setting) => {
            acc[setting.key] = JSON.parse(setting.value);
            return acc;
        }, {});
        res.json({
            success: true,
            data: rateLimitSettings
        });
    }
    catch (error) {
        console.error('Error fetching rate limit settings:', error);
        res.status(500).json({ error: 'Failed to fetch rate limit settings' });
    }
});
router.put('/settings', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { settings } = req.body;
        const userId = req.user.id;
        const validSettings = {
            general: {
                windowMs: 15 * 60 * 1000,
                max: 200,
                message: 'Too many API requests from this IP, please try again later.'
            },
            auth: {
                windowMs: 15 * 60 * 1000,
                max: 10,
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
        for (const [key, value] of Object.entries(settings)) {
            if (validSettings[key]) {
                await db_1.db
                    .insert(schema_1.systemSettings)
                    .values({
                    key: `rate_limit_${key}`,
                    value: JSON.stringify(value),
                    description: `Rate limit settings for ${key}`,
                    category: 'rate_limits',
                    updatedBy: userId
                })
                    .onConflictDoUpdate({
                    target: schema_1.systemSettings.key,
                    set: {
                        value: JSON.stringify(value),
                        updatedBy: userId,
                        updatedAt: new Date()
                    }
                });
            }
        }
        res.json({
            success: true,
            message: 'Rate limit settings updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating rate limit settings:', error);
        res.status(500).json({ error: 'Failed to update rate limit settings' });
    }
});
const rateLimitStats = {
    totalRequests: 0,
    blockedRequests: 0,
    ipBlockCounts: new Map(),
    rateLimitHits: {
        general: 0,
        auth: 0,
        payment: 0,
        upload: 0
    },
    last24Hours: {
        requests: 0,
        blocked: 0,
        uniqueIPs: new Set()
    },
    lastReset: new Date()
};
const trackRateLimitHit = (type, ip) => {
    rateLimitStats.totalRequests++;
    rateLimitStats.blockedRequests++;
    rateLimitStats.rateLimitHits[type]++;
    const currentCount = rateLimitStats.ipBlockCounts.get(ip) || 0;
    rateLimitStats.ipBlockCounts.set(ip, currentCount + 1);
    const now = new Date();
    const hoursSinceReset = (now.getTime() - rateLimitStats.lastReset.getTime()) / (1000 * 60 * 60);
    if (hoursSinceReset >= 24) {
        rateLimitStats.last24Hours = {
            requests: 0,
            blocked: 0,
            uniqueIPs: new Set()
        };
        rateLimitStats.lastReset = now;
    }
    rateLimitStats.last24Hours.requests++;
    rateLimitStats.last24Hours.blocked++;
    rateLimitStats.last24Hours.uniqueIPs.add(ip);
};
exports.trackRateLimitHit = trackRateLimitHit;
const trackSuccessfulRequest = (ip) => {
    rateLimitStats.totalRequests++;
    const now = new Date();
    const hoursSinceReset = (now.getTime() - rateLimitStats.lastReset.getTime()) / (1000 * 60 * 60);
    if (hoursSinceReset >= 24) {
        rateLimitStats.last24Hours = {
            requests: 0,
            blocked: 0,
            uniqueIPs: new Set()
        };
        rateLimitStats.lastReset = now;
    }
    rateLimitStats.last24Hours.requests++;
    rateLimitStats.last24Hours.uniqueIPs.add(ip);
};
exports.trackSuccessfulRequest = trackSuccessfulRequest;
router.get('/stats', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const topBlockedIPs = Array.from(rateLimitStats.ipBlockCounts.entries())
            .map(([ip, count]) => ({ ip, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
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
    }
    catch (error) {
        console.error('Error fetching rate limit stats:', error);
        res.status(500).json({ error: 'Failed to fetch rate limit statistics' });
    }
});
router.post('/reset', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
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
            uniqueIPs: new Set()
        };
        rateLimitStats.lastReset = new Date();
        res.json({
            success: true,
            message: 'Rate limit counters reset successfully'
        });
    }
    catch (error) {
        console.error('Error resetting rate limit counters:', error);
        res.status(500).json({ error: 'Failed to reset rate limit counters' });
    }
});
exports.default = router;
