"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllSecurityBlocks = exports.clearSecurityBlocks = exports.getSecurityStatus = exports.checkAttemptWarning = exports.enhancedLoginRateLimit = exports.detectMaliciousActivity = exports.recordSuccessfulLogin = exports.recordFailedAttempt = exports.checkSecurityBlock = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const attemptStore = new Map();
const getClientInfo = (req) => {
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
const createAttemptKey = (email, ipAddress) => {
    return `${email}:${ipAddress}`;
};
const checkSecurityBlock = async (req, res, next) => {
    const { email } = req.body;
    if (!email)
        return next();
    const { ipAddress } = getClientInfo(req);
    const attemptKey = createAttemptKey(email, ipAddress);
    const attempts = attemptStore.get(attemptKey) || [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = attempts.filter(attempt => attempt.attemptTime > oneHourAgo);
    attemptStore.set(attemptKey, recentAttempts);
    const isBlocked = recentAttempts.some(attempt => attempt.isBlocked);
    if (isBlocked) {
        const blockReason = recentAttempts.find(a => a.isBlocked)?.blockReason || 'Security violation';
        return res.status(429).json({
            error: 'Account temporarily blocked',
            message: `This email and IP combination has been temporarily blocked due to: ${blockReason}. Please contact support or try again later.`,
            blockReason,
            blockedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            supportEmail: 'security@tirestore.com'
        });
    }
    next();
};
exports.checkSecurityBlock = checkSecurityBlock;
const recordFailedAttempt = (email, req, reason = 'Invalid credentials') => {
    const { ipAddress, userAgent, deviceInfo } = getClientInfo(req);
    const attemptKey = createAttemptKey(email, ipAddress);
    const attempts = attemptStore.get(attemptKey) || [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = attempts.filter(attempt => attempt.attemptTime > oneHourAgo);
    const newAttempt = {
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
    const failedCount = recentAttempts.filter(a => a.attemptType === 'login_failed').length;
    if (failedCount >= 6) {
        newAttempt.isBlocked = true;
        newAttempt.blockReason = `Too many failed login attempts (${failedCount}). Potential brute force attack detected.`;
        console.warn(`🚨 SECURITY ALERT: Email ${email} blocked from IP ${ipAddress} after ${failedCount} failed attempts`);
        console.warn(`Device Info: ${deviceInfo}`);
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
    }
    else if (failedCount >= 3) {
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
exports.recordFailedAttempt = recordFailedAttempt;
const recordSuccessfulLogin = (email, req) => {
    const { ipAddress } = getClientInfo(req);
    const attemptKey = createAttemptKey(email, ipAddress);
    attemptStore.delete(attemptKey);
    console.log(`✅ Successful login: ${email} from IP ${ipAddress}`);
};
exports.recordSuccessfulLogin = recordSuccessfulLogin;
const detectMaliciousActivity = (req, res, next) => {
    const { email, password } = req.body;
    const { ipAddress, userAgent, deviceInfo } = getClientInfo(req);
    const suspiciousPatterns = [
        !userAgent || userAgent === 'unknown',
        userAgent.toLowerCase().includes('bot'),
        userAgent.toLowerCase().includes('crawler'),
        userAgent.toLowerCase().includes('spider'),
        password && (password.includes('<script>') ||
            password.includes('javascript:') ||
            password.includes('eval(') ||
            password.length > 200 ||
            /['"<>{}]/.test(password)),
        email && (email.includes('<script>') ||
            email.includes('javascript:') ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
        !req.get('Accept'),
        !req.get('Accept-Language'),
        req.get('X-Requested-With') === 'XMLHttpRequest' && !req.get('Referer')
    ];
    const suspiciousScore = suspiciousPatterns.filter(Boolean).length;
    if (suspiciousScore >= 3) {
        if (email) {
            const attemptKey = createAttemptKey(email, ipAddress);
            const attempts = attemptStore.get(attemptKey) || [];
            const maliciousAttempt = {
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
exports.detectMaliciousActivity = detectMaliciousActivity;
exports.enhancedLoginRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: (req) => {
        const { ipAddress } = getClientInfo(req);
        let hasBlockedAccounts = false;
        for (const [key, attempts] of attemptStore.entries()) {
            if (key.includes(ipAddress) && attempts.some(a => a.isBlocked)) {
                hasBlockedAccounts = true;
                break;
            }
        }
        return hasBlockedAccounts ? 3 : 10;
    },
    message: (req) => {
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
            retryAfter: 15 * 60
        };
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const message = typeof res.locals.rateLimit?.message === 'object'
            ? res.locals.rateLimit.message
            : { error: 'Rate limit exceeded' };
        res.status(429).json(message);
    }
});
const logSecurityIncident = (incident) => {
    console.log(`[SECURITY LOG] ${incident.timestamp}: ${JSON.stringify(incident)}`);
};
const checkAttemptWarning = (req, res, next) => {
    const { email } = req.body;
    if (!email)
        return next();
    const { ipAddress } = getClientInfo(req);
    const attemptKey = createAttemptKey(email, ipAddress);
    const attempts = attemptStore.get(attemptKey) || [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = attempts.filter(attempt => attempt.attemptTime > oneHourAgo);
    const failedCount = recentAttempts.filter(a => a.attemptType === 'login_failed').length;
    if (failedCount >= 3 && failedCount < 6) {
        req.securityWarning = {
            failedAttempts: failedCount,
            attemptsRemaining: 6 - failedCount,
            message: `Warning: ${failedCount} failed login attempts detected. ${6 - failedCount} attempts remaining before account is temporarily blocked.`
        };
    }
    next();
};
exports.checkAttemptWarning = checkAttemptWarning;
const getSecurityStatus = (email, req) => {
    const { ipAddress } = getClientInfo(req);
    const attemptKey = createAttemptKey(email, ipAddress);
    const attempts = attemptStore.get(attemptKey) || [];
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
exports.getSecurityStatus = getSecurityStatus;
const clearSecurityBlocks = (email, ipAddress) => {
    if (email && ipAddress) {
        const attemptKey = createAttemptKey(email, ipAddress);
        attemptStore.delete(attemptKey);
        return { cleared: 1, type: 'specific', email, ipAddress };
    }
    else if (email) {
        let clearedCount = 0;
        for (const [key, attempts] of attemptStore.entries()) {
            if (key.startsWith(`${email}:`)) {
                attemptStore.delete(key);
                clearedCount++;
            }
        }
        return { cleared: clearedCount, type: 'email', email };
    }
    else if (ipAddress) {
        let clearedCount = 0;
        for (const [key, attempts] of attemptStore.entries()) {
            if (key.endsWith(`:${ipAddress}`)) {
                attemptStore.delete(key);
                clearedCount++;
            }
        }
        return { cleared: clearedCount, type: 'ip', ipAddress };
    }
    else {
        const totalBlocks = attemptStore.size;
        attemptStore.clear();
        return { cleared: totalBlocks, type: 'all' };
    }
};
exports.clearSecurityBlocks = clearSecurityBlocks;
const getAllSecurityBlocks = () => {
    const blocks = [];
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
exports.getAllSecurityBlocks = getAllSecurityBlocks;
