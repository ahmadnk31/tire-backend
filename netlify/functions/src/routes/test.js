"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const emailService_1 = require("../services/emailService");
const router = express_1.default.Router();
router.post('/test-email-localization', async (req, res) => {
    const { email, language = 'en', type = 'verification' } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    try {
        const token = Math.random().toString(36).substring(2);
        switch (type) {
            case 'verification':
                await (0, emailService_1.sendVerificationEmail)(email, token, language);
                break;
            case 'password-reset':
                await (0, emailService_1.sendPasswordResetEmail)(email, token, language);
                break;
            case 'contact-confirmation':
                await (0, emailService_1.sendContactConfirmationEmail)(email, 'Test User', 'general', 'Test Subject', language);
                break;
            default:
                return res.status(400).json({ error: 'Invalid email type. Use: verification, password-reset, or contact-confirmation' });
        }
        res.json({
            success: true,
            message: `Test ${type} email sent in ${language} language`,
            language,
            type,
            email
        });
    }
    catch (error) {
        console.error('Test email failed:', error);
        res.status(500).json({
            error: 'Failed to send test email',
            details: error.message,
            language,
            type
        });
    }
});
exports.default = router;
