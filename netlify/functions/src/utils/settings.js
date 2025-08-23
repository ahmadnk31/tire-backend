"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemSettings = getSystemSettings;
exports.getTokenExpirationHours = getTokenExpirationHours;
exports.getTokenExpirationSeconds = getTokenExpirationSeconds;
exports.getTokenExpirationString = getTokenExpirationString;
exports.clearSettingsCache = clearSettingsCache;
const db_1 = require("../db");
const schema_1 = require("../db/schema");
let settingsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;
async function getSystemSettings() {
    const now = Date.now();
    if (settingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
        return settingsCache;
    }
    try {
        const settings = await db_1.db.select().from(schema_1.systemSettings);
        const settingsObject = settings.reduce((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {});
        settingsCache = settingsObject;
        cacheTimestamp = now;
        return settingsObject;
    }
    catch (error) {
        console.error('Error fetching system settings:', error);
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
async function getTokenExpirationHours() {
    const settings = await getSystemSettings();
    return parseInt(settings.tokenExpirationHours) || 24;
}
async function getTokenExpirationSeconds() {
    const hours = await getTokenExpirationHours();
    return hours * 60 * 60;
}
async function getTokenExpirationString() {
    const hours = await getTokenExpirationHours();
    return `${hours}h`;
}
function clearSettingsCache() {
    settingsCache = null;
    cacheTimestamp = 0;
}
