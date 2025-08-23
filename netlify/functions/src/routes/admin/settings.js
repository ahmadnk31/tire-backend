"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../middleware/auth");
const db_1 = require("../../db");
const schema_1 = require("../../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = express_1.default.Router();
router.get('/', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const settings = await db_1.db.select().from(schema_1.systemSettings);
        const settingsObject = settings.reduce((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {});
        res.json({
            settings: {
                tokenExpirationHours: parseInt(settingsObject.tokenExpirationHours) || 24,
                refreshTokenExpirationDays: parseInt(settingsObject.refreshTokenExpirationDays) || 30,
                maxLoginAttempts: parseInt(settingsObject.maxLoginAttempts) || 5,
                lockoutDurationMinutes: parseInt(settingsObject.lockoutDurationMinutes) || 15,
                requireEmailVerification: settingsObject.requireEmailVerification === 'true',
                requireTwoFactorAuth: settingsObject.requireTwoFactorAuth === 'true',
                passwordMinLength: parseInt(settingsObject.passwordMinLength) || 8,
                passwordRequireSpecialChars: settingsObject.passwordRequireSpecialChars === 'true',
                sessionTimeoutMinutes: parseInt(settingsObject.sessionTimeoutMinutes) || 60,
                smtpHost: settingsObject.smtpHost || '',
                smtpPort: parseInt(settingsObject.smtpPort) || 587,
                smtpUsername: settingsObject.smtpUsername || '',
                smtpPassword: settingsObject.smtpPassword || '',
                emailFromAddress: settingsObject.emailFromAddress || '',
                emailFromName: settingsObject.emailFromName || '',
                maintenanceMode: settingsObject.maintenanceMode === 'true',
                debugMode: settingsObject.debugMode === 'true',
                maxFileUploadSize: parseInt(settingsObject.maxFileUploadSize) || 10,
                allowedFileTypes: settingsObject.allowedFileTypes ? settingsObject.allowedFileTypes.split(',') : ['jpg', 'png', 'pdf'],
                emailNotifications: settingsObject.emailNotifications === 'true',
                adminNotifications: settingsObject.adminNotifications === 'true',
                notificationRetentionDays: parseInt(settingsObject.notificationRetentionDays) || 30,
                autoBackupEnabled: settingsObject.autoBackupEnabled === 'true',
                backupFrequency: settingsObject.backupFrequency || 'daily',
                backupRetentionDays: parseInt(settingsObject.backupRetentionDays) || 30,
                backupLocation: settingsObject.backupLocation || '',
            }
        });
    }
    catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
router.put('/', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const updates = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        for (const [key, value] of Object.entries(updates)) {
            const stringValue = Array.isArray(value) ? value.join(',') : String(value);
            await db_1.db
                .insert(schema_1.systemSettings)
                .values({
                key,
                value: stringValue,
                updatedBy: userId,
                updatedAt: new Date(),
            })
                .onConflictDoUpdate({
                target: schema_1.systemSettings.key,
                set: {
                    value: stringValue,
                    updatedBy: userId,
                    updatedAt: new Date(),
                },
            });
        }
        res.json({ success: true, message: 'Settings updated successfully' });
    }
    catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});
router.post('/test-email', auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const emailSettings = await db_1.db
            .select()
            .from(schema_1.systemSettings)
            .where((0, drizzle_orm_1.eq)(schema_1.systemSettings.key, 'smtpHost'));
        if (!emailSettings.length) {
            return res.status(400).json({ error: 'Email settings not configured' });
        }
        res.json({
            success: true,
            message: 'Test email sent successfully (mock implementation)'
        });
    }
    catch (error) {
        console.error('Error testing email:', error);
        res.status(500).json({ error: 'Failed to send test email' });
    }
});
exports.default = router;
