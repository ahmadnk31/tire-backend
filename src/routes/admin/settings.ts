import express from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { db } from '../../db';
import { systemSettings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { clearSettingsCache } from '../../utils/settings';

const router = express.Router();

// GET /api/admin/settings - Get all system settings
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const settings = await db.select().from(systemSettings);
    
    // Convert array to object for easier frontend consumption
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    res.json({ 
      settings: {
        // Token Settings
        tokenExpirationHours: parseInt(settingsObject.tokenExpirationHours) || 24,
        refreshTokenExpirationDays: parseInt(settingsObject.refreshTokenExpirationDays) || 30,
        maxLoginAttempts: parseInt(settingsObject.maxLoginAttempts) || 5,
        lockoutDurationMinutes: parseInt(settingsObject.lockoutDurationMinutes) || 15,
        
        // Security Settings
        requireEmailVerification: settingsObject.requireEmailVerification === 'true',
        requireTwoFactorAuth: settingsObject.requireTwoFactorAuth === 'true',
        passwordMinLength: parseInt(settingsObject.passwordMinLength) || 8,
        passwordRequireSpecialChars: settingsObject.passwordRequireSpecialChars === 'true',
        sessionTimeoutMinutes: parseInt(settingsObject.sessionTimeoutMinutes) || 60,
        
        // Email Settings
        smtpHost: settingsObject.smtpHost || '',
        smtpPort: parseInt(settingsObject.smtpPort) || 587,
        smtpUsername: settingsObject.smtpUsername || '',
        smtpPassword: settingsObject.smtpPassword || '',
        emailFromAddress: settingsObject.emailFromAddress || '',
        emailFromName: settingsObject.emailFromName || '',
        
        // System Settings
        maintenanceMode: settingsObject.maintenanceMode === 'true',
        debugMode: settingsObject.debugMode === 'true',
        maxFileUploadSize: parseInt(settingsObject.maxFileUploadSize) || 10,
        allowedFileTypes: settingsObject.allowedFileTypes ? settingsObject.allowedFileTypes.split(',') : ['jpg', 'png', 'pdf'],
        
        // Notification Settings
        emailNotifications: settingsObject.emailNotifications === 'true',
        adminNotifications: settingsObject.adminNotifications === 'true',
        notificationRetentionDays: parseInt(settingsObject.notificationRetentionDays) || 30,
        
        // Backup Settings
        autoBackupEnabled: settingsObject.autoBackupEnabled === 'true',
        backupFrequency: settingsObject.backupFrequency || 'daily',
        backupRetentionDays: parseInt(settingsObject.backupRetentionDays) || 30,
        backupLocation: settingsObject.backupLocation || '',
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings - Update system settings
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    const userId = (req as any).user?.id;

    // Validate that user is admin
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Update each setting
    for (const [key, value] of Object.entries(updates)) {
      const stringValue = Array.isArray(value) ? value.join(',') : String(value);
      
      await db
        .insert(systemSettings)
        .values({
          key,
          value: stringValue,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: stringValue,
            updatedBy: userId,
            updatedAt: new Date(),
          },
        });
    }

    // Clear settings cache to ensure fresh data
    clearSettingsCache();
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/admin/settings/test-email - Test email configuration
router.post('/test-email', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get current email settings
    const emailSettings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'smtpHost'));

    if (!emailSettings.length) {
      return res.status(400).json({ error: 'Email settings not configured' });
    }

    // Here you would implement actual email sending logic
    // For now, we'll just return success
    res.json({ 
      success: true, 
      message: 'Test email sent successfully (mock implementation)' 
    });
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

export default router;
