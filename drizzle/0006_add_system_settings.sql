-- Add system_settings table
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL UNIQUE,
	"value" text NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL DEFAULT 'general',
	"updated_by" integer REFERENCES "users"("id"),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);

-- Insert default system settings
INSERT INTO "system_settings" ("key", "value", "description", "category") VALUES
-- Token Settings
('tokenExpirationHours', '24', 'JWT token expiration time in hours', 'security'),
('refreshTokenExpirationDays', '30', 'Refresh token expiration time in days', 'security'),
('maxLoginAttempts', '5', 'Maximum failed login attempts before lockout', 'security'),
('lockoutDurationMinutes', '15', 'Account lockout duration in minutes', 'security'),

-- Security Settings
('requireEmailVerification', 'false', 'Require email verification for new accounts', 'security'),
('requireTwoFactorAuth', 'false', 'Require two-factor authentication', 'security'),
('passwordMinLength', '8', 'Minimum password length', 'security'),
('passwordRequireSpecialChars', 'false', 'Require special characters in passwords', 'security'),
('sessionTimeoutMinutes', '60', 'Session timeout in minutes', 'security'),

-- Email Settings
('smtpHost', '', 'SMTP server host', 'email'),
('smtpPort', '587', 'SMTP server port', 'email'),
('smtpUsername', '', 'SMTP username', 'email'),
('smtpPassword', '', 'SMTP password', 'email'),
('emailFromAddress', '', 'Default from email address', 'email'),
('emailFromName', '', 'Default from name', 'email'),

-- System Settings
('maintenanceMode', 'false', 'Enable maintenance mode', 'general'),
('debugMode', 'false', 'Enable debug mode', 'general'),
('maxFileUploadSize', '10', 'Maximum file upload size in MB', 'general'),
('allowedFileTypes', 'jpg,png,pdf,doc,docx', 'Allowed file types for uploads', 'general'),

-- Notification Settings
('emailNotifications', 'true', 'Enable email notifications', 'notifications'),
('adminNotifications', 'true', 'Send notifications to administrators', 'notifications'),
('notificationRetentionDays', '30', 'How long to keep notification history', 'notifications'),

-- Backup Settings
('autoBackupEnabled', 'false', 'Enable automatic backups', 'backups'),
('backupFrequency', 'daily', 'Backup frequency (daily/weekly/monthly)', 'backups'),
('backupRetentionDays', '30', 'How long to keep backups', 'backups'),
('backupLocation', '', 'Backup storage location', 'backups')
ON CONFLICT ("key") DO NOTHING;
