import express, { Request, Response } from 'express';
import { sendVerificationEmail, sendPasswordResetEmail, sendContactConfirmationEmail } from '../services/emailService';

const router = express.Router();

// Test email localization
router.post('/test-email-localization', async (req: Request, res: Response) => {
  const { email, language = 'en', type = 'verification' } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const token = Math.random().toString(36).substring(2);
    
    switch (type) {
      case 'verification':
        await sendVerificationEmail(email, token, language);
        break;
      case 'password-reset':
        await sendPasswordResetEmail(email, token, language);
        break;
      case 'contact-confirmation':
        await sendContactConfirmationEmail(email, 'Test User', 'general', 'Test Subject', language);
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
  } catch (error: any) {
    console.error('Test email failed:', error);
    res.status(500).json({ 
      error: 'Failed to send test email', 
      details: error.message,
      language,
      type
    });
  }
});

export default router;
