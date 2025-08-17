

import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sendVerificationEmail } from '../services/emailService';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { 
  checkSecurityBlock, 
  recordFailedAttempt, 
  recordSuccessfulLogin, 
  detectMaliciousActivity,
  enhancedLoginRateLimit,
  checkAttemptWarning,
  getSecurityStatus,
  clearSecurityBlocks,
  getAllSecurityBlocks
} from '../middleware/securityRateLimit';

const router = express.Router();

// ...existing code...

// Resend verification email
router.post('/resend-verification', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.emailVerified) return res.status(400).json({ error: 'Email already verified' });
  const token = user.verificationToken || Math.random().toString(36).substring(2);
  if (!user.verificationToken) {
    await db.update(users).set({ verificationToken: token }).where(eq(users.email, email));
  }
  await sendVerificationEmail(email, token);
  res.json({ success: true, message: 'Verification email resent.' });
});
// Register
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  const hashed = await bcrypt.hash(password, 10);
  const token = Math.random().toString(36).substring(2);
  try {
    await db.insert(users).values({ name, email, password: hashed, role: role || 'user', verificationToken: token });
    await sendVerificationEmail(email, token);
    res.json({ success: true, message: 'Registration successful. Please check your email to verify your account.' });
  } catch (err: any) {
    // Handle duplicate email error
    if (err?.code === '23505' && String(err?.detail).includes('users_email_unique')) {
      return res.status(409).json({ error: 'Email already registered. Please login or use a different email.' });
    }
    console.error('Registration failed:', err);
    res.status(500).json({ error: 'Registration failed', details: err?.message || err });
  }
});

// Email verification
router.get('/verify', async (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email : undefined;
  const token = typeof req.query.token === 'string' ? req.query.token : undefined;
  if (!email || !token) return res.status(400).json({ error: 'Missing email or token' });
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || user.verificationToken !== token) return res.status(400).json({ error: 'Invalid token' });
  await db.update(users).set({ emailVerified: true, verificationToken: null }).where(eq(users.email, email));
  res.json({ success: true });
});

// Login with enhanced security
router.post('/login', 
  enhancedLoginRateLimit,
  detectMaliciousActivity,
  checkSecurityBlock,
  checkAttemptWarning,
  async (req: Request, res: Response) => {
    const { email, password, resendVerification } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }
    
    try {
      const user = await db.query.users.findFirst({ where: eq(users.email, email) });
      
      if (!user) {
        // Record failed attempt for non-existent user (prevent email enumeration)
        const attemptResult = recordFailedAttempt(email, req, 'Invalid credentials - user not found');
        
        return res.status(401).json({ 
          error: 'Invalid credentials',
          ...(attemptResult.isWarning && {
            warning: `${attemptResult.failedCount} failed attempts. ${attemptResult.attemptsRemaining} attempts remaining.`
          })
        });
      }
      
      if (!user.emailVerified) {
        if (resendVerification) {
          // Resend verification email
          const token = user.verificationToken || Math.random().toString(36).substring(2);
          if (!user.verificationToken) {
            await db.update(users).set({ verificationToken: token }).where(eq(users.email, email));
          }
          await sendVerificationEmail(email, token);
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
      
      const valid = await bcrypt.compare(password, user.password);
      
      if (!valid) {
        // Record failed attempt
        const attemptResult = recordFailedAttempt(email, req, 'Invalid password');
        
        const response: any = { error: 'Invalid credentials' };
        
        if (attemptResult.isWarning) {
          response.warning = `${attemptResult.failedCount} failed attempts detected. ${attemptResult.attemptsRemaining} attempts remaining before temporary block.`;
        }
        
        if (attemptResult.isBlocked) {
          response.blocked = true;
          response.message = 'Account temporarily blocked due to too many failed attempts. Please try again in 1 hour.';
        }
        
        return res.status(401).json(response);
      }
      
      // Successful login - clear any previous failed attempts
      recordSuccessfulLogin(email, req);
      
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '2h' });
      
      const response: any = {
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role, 
          emailVerified: user.emailVerified 
        }
      };
      
      // Include warning if there was one from previous attempts
      const securityWarning = (req as any).securityWarning;
      if (securityWarning) {
        response.securityWarning = securityWarning.message;
      }
      
      res.json(response);
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Forgot Password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const resetToken = Math.random().toString(36).substring(2);
  await db.update(users).set({ resetToken }).where(eq(users.email, email));
  // TODO: Send resetToken via email (reuse sendVerificationEmail or create sendResetEmail)
  await sendVerificationEmail(email, resetToken); // Replace with sendResetEmail for real use
  res.json({ success: true });
});

// Reset Password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) return res.status(400).json({ error: 'Missing fields' });
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || user.resetToken !== token) return res.status(400).json({ error: 'Invalid token' });
  const hashed = await bcrypt.hash(password, 10);
  await db.update(users).set({ password: hashed, resetToken: null }).where(eq(users.email, email));
  res.json({ success: true });
});

// Social login placeholder
router.post('/social-login', async (req: Request, res: Response) => {
  // Implement OAuth logic here
  res.status(501).json({ error: 'Not implemented' });
});

// Logout (client-side: just remove token)
router.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true });
  }
);

// Security status endpoint (admin only)
router.get('/security-status/:email', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const status = getSecurityStatus(email, req);
    
    res.json({
      email,
      securityStatus: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Security status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear security blocks endpoint (admin only)
router.post('/clear-security-block', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, ipAddress } = req.body;
    
    const result = clearSecurityBlocks(email, ipAddress);
    
    res.json({ 
      success: true, 
      message: `Cleared ${result.cleared} security block(s)`,
      details: result,
      clearedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Clear security block error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all security blocks endpoint (admin only)
router.get('/security-blocks', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const blocks = getAllSecurityBlocks();
    
    res.json({
      blocks,
      total: blocks.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get security blocks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Emergency admin bypass login (only in development)
router.post('/emergency-login', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint not available' });
  }
  
  const { email, password, emergencyKey } = req.body;
  
  // Emergency bypass key check
  if (emergencyKey !== 'EMERGENCY_BYPASS_2025') {
    return res.status(401).json({ error: 'Invalid emergency key' });
  }
  
  try {
    if (email !== 'admin@tirestore.com') {
      return res.status(401).json({ error: 'Emergency login only for admin' });
    }
    
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Clear all security blocks for this session
    clearSecurityBlocks();
    
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '2h' });
    
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
    
  } catch (error) {
    console.error('Emergency login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear all security blocks (emergency endpoint)
router.post('/emergency-clear-blocks', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint not available' });
  }
  
  const { emergencyKey } = req.body;
  
  if (emergencyKey !== 'EMERGENCY_BYPASS_2025') {
    return res.status(401).json({ error: 'Invalid emergency key' });
  }
  
  try {
    const result = clearSecurityBlocks();
    
    res.json({
      success: true,
      message: 'All security blocks cleared via emergency endpoint',
      details: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Emergency clear blocks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
