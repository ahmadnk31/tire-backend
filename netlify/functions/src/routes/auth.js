"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const emailService_1 = require("../services/emailService");
const auth_1 = require("../middleware/auth");
const securityRateLimit_1 = require("../middleware/securityRateLimit");
const settings_1 = require("../utils/settings");
const router = express_1.default.Router();
router.post('/resend-verification', async (req, res) => {
    const { email, language } = req.body;
    if (!email)
        return res.status(400).json({ error: 'Missing email' });
    const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.email, email) });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified)
        return res.status(400).json({ error: 'Email already verified' });
    const token = user.verificationToken || Math.random().toString(36).substring(2);
    if (!user.verificationToken) {
        await db_1.db.update(schema_1.users).set({ verificationToken: token }).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
    }
    await (0, emailService_1.sendVerificationEmail)(email, token);
    res.json({ success: true, message: 'Verification email resent.' });
});
router.post('/register', async (req, res) => {
    const { name, email, password, role, language } = req.body;
    console.log('Registration attempt:', { name, email, role: role || 'user' });
    if (!name || !email || !password) {
        console.log('Missing fields in registration');
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        const hashed = await bcryptjs_1.default.hash(password, 10);
        const token = Math.random().toString(36).substring(2);
        console.log('Creating user in database...');
        await db_1.db.insert(schema_1.users).values({
            name,
            email,
            password: hashed,
            role: role || 'user',
            verificationToken: token
        });
        console.log('User created successfully, sending verification email...');
        try {
            await (0, emailService_1.sendVerificationEmail)(email, token, language || 'en');
            console.log('Verification email sent successfully');
        }
        catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            return res.json({
                success: true,
                message: 'Registration successful. Please check your email to verify your account.',
                warning: 'Email verification may be delayed. Please check your spam folder or contact support if you don\'t receive it.'
            });
        }
        res.json({ success: true, message: 'Registration successful. Please check your email to verify your account.' });
    }
    catch (err) {
        console.error('Registration failed:', err);
        if (err?.code === '23505' && String(err?.detail).includes('users_email_unique')) {
            return res.status(409).json({ error: 'Email already registered. Please login or use a different email.' });
        }
        if (err?.code) {
            console.error('Database error code:', err.code);
            return res.status(500).json({ error: 'Registration failed', details: 'Database error occurred' });
        }
        res.status(500).json({ error: 'Registration failed', details: err?.message || 'Unknown error occurred' });
    }
});
router.get('/test-email', async (req, res) => {
    try {
        console.log('Testing email service...');
        console.log('Environment variables:', {
            FRONTEND_URL: process.env.FRONTEND_URL,
            SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
            MY_AWS_REGION: process.env.MY_AWS_REGION,
            hasAccessKey: !!process.env.MY_AWS_ACCESS_KEY_ID,
            hasSecretKey: !!process.env.MY_AWS_SECRET_ACCESS_KEY
        });
        res.json({
            success: true,
            message: 'Email service test endpoint',
            config: {
                frontendUrl: process.env.FRONTEND_URL,
                sesFromEmail: process.env.SES_FROM_EMAIL,
                awsRegion: process.env.MY_AWS_REGION,
                hasCredentials: !!(process.env.MY_AWS_ACCESS_KEY_ID && process.env.MY_AWS_SECRET_ACCESS_KEY)
            }
        });
    }
    catch (error) {
        console.error('Email service test failed:', error);
        res.status(500).json({ error: 'Email service test failed', details: error.message });
    }
});
router.get('/verify', async (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email : undefined;
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (!email || !token)
        return res.status(400).json({ error: 'Missing email or token' });
    const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.email, email) });
    if (!user || user.verificationToken !== token)
        return res.status(400).json({ error: 'Invalid token' });
    await db_1.db.update(schema_1.users).set({ emailVerified: true, verificationToken: null }).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
    res.json({ success: true });
});
router.post('/login', securityRateLimit_1.enhancedLoginRateLimit, securityRateLimit_1.detectMaliciousActivity, securityRateLimit_1.checkSecurityBlock, securityRateLimit_1.checkAttemptWarning, async (req, res) => {
    const { email, password, resendVerification, language } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
    }
    try {
        const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.email, email) });
        if (!user) {
            const attemptResult = (0, securityRateLimit_1.recordFailedAttempt)(email, req, 'Invalid credentials - user not found');
            return res.status(401).json({
                error: 'Invalid credentials',
                ...(attemptResult.isWarning && {
                    warning: `${attemptResult.failedCount} failed attempts. ${attemptResult.attemptsRemaining} attempts remaining.`
                })
            });
        }
        if (!user.emailVerified) {
            if (resendVerification) {
                const token = user.verificationToken || Math.random().toString(36).substring(2);
                if (!user.verificationToken) {
                    await db_1.db.update(schema_1.users).set({ verificationToken: token }).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
                }
                await (0, emailService_1.sendVerificationEmail)(email, token, language || 'en');
                return res.status(200).json({
                    error: 'Email not verified. Verification email resent.',
                    unverified: true,
                    resent: true
                });
            }
            return res.status(401).json({
                error: 'Email not verified. Please verify your email.',
                unverified: true
            });
        }
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid) {
            const attemptResult = (0, securityRateLimit_1.recordFailedAttempt)(email, req, 'Invalid password');
            const response = { error: 'Invalid credentials' };
            if (attemptResult.isWarning) {
                response.warning = `${attemptResult.failedCount} failed attempts detected. ${attemptResult.attemptsRemaining} attempts remaining before temporary block.`;
            }
            if (attemptResult.isBlocked) {
                response.blocked = true;
                response.message = 'Account temporarily blocked due to too many failed attempts. Please try again in 1 hour.';
            }
            return res.status(401).json(response);
        }
        (0, securityRateLimit_1.recordSuccessfulLogin)(email, req);
        const tokenExpiration = await (0, settings_1.getTokenExpirationString)();
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: tokenExpiration });
        const response = {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: user.emailVerified
            }
        };
        const securityWarning = req.securityWarning;
        if (securityWarning) {
            response.securityWarning = securityWarning.message;
        }
        res.json(response);
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/forgot-password', async (req, res) => {
    const { email, language } = req.body;
    if (!email)
        return res.status(400).json({ error: 'Missing email' });
    const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.email, email) });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const resetToken = Math.random().toString(36).substring(2);
    await db_1.db.update(schema_1.users).set({ resetToken }).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
    await (0, emailService_1.sendPasswordResetEmail)(email, resetToken, language || 'en');
    res.json({ success: true });
});
router.post('/reset-password', async (req, res) => {
    const { email, token, password } = req.body;
    if (!email || !token || !password)
        return res.status(400).json({ error: 'Missing fields' });
    const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.email, email) });
    if (!user || user.resetToken !== token)
        return res.status(400).json({ error: 'Invalid token' });
    const hashed = await bcryptjs_1.default.hash(password, 10);
    await db_1.db.update(schema_1.users).set({ password: hashed, resetToken: null }).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
    res.json({ success: true });
});
router.post('/social-login', async (req, res) => {
    res.status(501).json({ error: 'Not implemented' });
});
router.post('/logout', (req, res) => {
    res.json({ success: true });
});
router.get('/security-status/:email', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { email } = req.params;
        const status = (0, securityRateLimit_1.getSecurityStatus)(email, req);
        res.json({
            email,
            securityStatus: status,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Security status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/clear-security-block', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { email, ipAddress } = req.body;
        const result = (0, securityRateLimit_1.clearSecurityBlocks)(email, ipAddress);
        res.json({
            success: true,
            message: `Cleared ${result.cleared} security block(s)`,
            details: result,
            clearedAt: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Clear security block error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/security-blocks', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const blocks = (0, securityRateLimit_1.getAllSecurityBlocks)();
        res.json({
            blocks,
            total: blocks.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Get security blocks error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/emergency-login', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Endpoint not available' });
    }
    const { email, password, emergencyKey } = req.body;
    if (emergencyKey !== 'EMERGENCY_BYPASS_2025') {
        return res.status(401).json({ error: 'Invalid emergency key' });
    }
    try {
        if (email !== 'admin@tirestore.com') {
            return res.status(401).json({ error: 'Emergency login only for admin' });
        }
        const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.email, email) });
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        (0, securityRateLimit_1.clearSecurityBlocks)();
        const tokenExpiration = await (0, settings_1.getTokenExpirationString)();
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: tokenExpiration });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: user.emailVerified
            },
            message: 'Emergency login successful - all security blocks cleared'
        });
    }
    catch (error) {
        console.error('Emergency login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/emergency-clear-blocks', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Endpoint not available' });
    }
    const { emergencyKey } = req.body;
    if (emergencyKey !== 'EMERGENCY_BYPASS_2025') {
        return res.status(401).json({ error: 'Invalid emergency key' });
    }
    try {
        const result = (0, securityRateLimit_1.clearSecurityBlocks)();
        res.json({
            success: true,
            message: 'All security blocks cleared via emergency endpoint',
            details: result,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Emergency clear blocks error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/me', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('🔍 Checking user info for ID:', userId);
        const user = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.id, userId),
            columns: {
                id: true,
                name: true,
                email: true,
                role: true,
                emailVerified: true,
                isActive: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('👤 User details from DB:', {
            id: user.id,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified
        });
        console.log('🎫 JWT payload:', req.user);
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: user.emailVerified,
                isActive: user.isActive
            },
            jwtPayload: req.user
        });
    }
    catch (error) {
        console.error('Error getting user info:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});
exports.default = router;
