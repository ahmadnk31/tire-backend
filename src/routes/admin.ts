import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { 
  getSecurityStatus,
  clearSecurityBlocks,
  getAllSecurityBlocks
} from '../middleware/securityRateLimit';
import settingsRouter from './admin/settings';
import backupsRouter from './admin/backups';

const router = Router();

// Admin-only routes with relaxed rate limiting

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

// Emergency clear all blocks (admin only)
router.post('/emergency-clear-blocks', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = clearSecurityBlocks();
    
    res.json({
      success: true,
      message: 'All security blocks cleared via admin endpoint',
      details: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Emergency clear blocks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount admin sub-routes
router.use('/settings', settingsRouter);
router.use('/backups', backupsRouter);


export default router;
