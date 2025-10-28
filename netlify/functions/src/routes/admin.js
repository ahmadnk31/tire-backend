"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const securityRateLimit_1 = require("../middleware/securityRateLimit");
const settings_1 = __importDefault(require("./admin/settings"));
const backups_1 = __importDefault(require("./admin/backups"));
const router = (0, express_1.Router)();
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
router.post('/emergency-clear-blocks', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const result = (0, securityRateLimit_1.clearSecurityBlocks)();
        res.json({
            success: true,
            message: 'All security blocks cleared via admin endpoint',
            details: result,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Emergency clear blocks error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.use('/settings', settings_1.default);
router.use('/backups', backups_1.default);
exports.default = router;
