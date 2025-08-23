import { db } from '../db';
import { systemSettings } from '../db/schema';

// Cache for settings to avoid repeated database calls
let settingsCache: Record<string, any> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get system settings with caching
export async function getSystemSettings(): Promise<Record<string, any>> {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (settingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return settingsCache;
  }
  
  try {
    const settings = await db.select().from(systemSettings);
    
    // Convert array to object
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);
    
    // Cache the settings
    settingsCache = settingsObject;
    cacheTimestamp = now;
    
    return settingsObject;
  } catch (error) {
    console.error('Error fetching system settings:', error);
    // Return default settings if database error
    return {
      tokenExpirationHours: '24',
      refreshTokenExpirationDays: '30',
      maxLoginAttempts: '5',
      lockoutDurationMinutes: '15',
      sessionTimeoutMinutes: '60',
      passwordMinLength: '8',
      requireEmailVerification: 'false',
      requireTwoFactorAuth: 'false',
      maintenanceMode: 'false',
      debugMode: 'false',
      emailNotifications: 'true',
      adminNotifications: 'true',
      autoBackupEnabled: 'false',
      backupFrequency: 'daily',
      backupRetentionDays: '30',
      notificationRetentionDays: '30',
      maxFileUploadSize: '10',
      allowedFileTypes: 'jpg,png,pdf',
      smtpHost: '',
      smtpPort: '587',
      smtpUsername: '',
      smtpPassword: '',
      emailFromAddress: '',
      emailFromName: '',
      backupLocation: ''
    };
  }
}

// Get token expiration in hours
export async function getTokenExpirationHours(): Promise<number> {
  const settings = await getSystemSettings();
  return parseInt(settings.tokenExpirationHours) || 24;
}

// Get token expiration in seconds (for JWT)
export async function getTokenExpirationSeconds(): Promise<number> {
  const hours = await getTokenExpirationHours();
  return hours * 60 * 60; // Convert hours to seconds
}

// Get token expiration string for JWT (e.g., "24h")
export async function getTokenExpirationString(): Promise<string> {
  const hours = await getTokenExpirationHours();
  return `${hours}h`;
}

// Clear settings cache (call this when settings are updated)
export function clearSettingsCache(): void {
  settingsCache = null;
  cacheTimestamp = 0;
}
