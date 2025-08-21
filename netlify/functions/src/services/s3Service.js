"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
class S3Service {
    constructor() {
        console.log('🔧 S3Service Configuration:', {
            region: process.env.MY_AWS_REGION || 'us-east-1',
            bucket: process.env.MY_AWS_S3_BUCKET_NAME || 'tire-store-images',
            hasAccessKey: !!process.env.MY_AWS_ACCESS_KEY_ID,
            hasSecretKey: !!process.env.MY_AWS_SECRET_ACCESS_KEY,
        });
        this.s3Client = new client_s3_1.S3Client({
            region: process.env.MY_AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
            },
        });
        this.bucketName = process.env.MY_AWS_S3_BUCKET_NAME || 'tire-store-images';
    }
    async uploadFile({ file, filename, mimetype, folder = 'products' }) {
        try {
            console.log('📤 Starting S3 upload:', {
                filename,
                mimetype,
                folder,
                fileSize: file.length,
                bucketName: this.bucketName
            });
            const fileExtension = path_1.default.extname(filename);
            const uniqueFilename = `${(0, uuid_1.v4)()}${fileExtension}`;
            const key = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file,
                ContentType: mimetype,
                Metadata: {
                    originalName: filename,
                    uploadedAt: new Date().toISOString(),
                },
            });
            await this.s3Client.send(command);
            const region = process.env.MY_AWS_REGION || 'us-east-1';
            const imageUrl = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
            console.log('✅ S3 upload successful:', {
                key,
                imageUrl,
                originalFilename: filename
            });
            return imageUrl;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('❌ S3 upload error:', {
                error: errorMessage,
                stack: errorStack,
                filename,
                mimetype,
                bucketName: this.bucketName,
                region: process.env.MY_AWS_REGION,
                hasCredentials: !!(process.env.MY_AWS_ACCESS_KEY_ID && process.env.MY_AWS_SECRET_ACCESS_KEY)
            });
            throw new Error(`S3 upload failed: ${errorMessage}`);
        }
    }
    async deleteFile(fileUrl) {
        try {
            const key = this.extractKeyFromUrl(fileUrl);
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            await this.s3Client.send(command);
        }
        catch (error) {
            console.error('Error deleting file from S3:', error);
            throw new Error('Failed to delete file');
        }
    }
    async getPresignedUrl({ key, expiresIn = 3600 }) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            return await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn });
        }
        catch (error) {
            console.error('Error generating presigned URL:', error);
            throw new Error('Failed to generate presigned URL');
        }
    }
    async uploadMultipleFiles(files) {
        try {
            const uploadPromises = files.map(file => this.uploadFile(file));
            return await Promise.all(uploadPromises);
        }
        catch (error) {
            console.error('Error uploading multiple files:', error);
            throw new Error('Failed to upload files');
        }
    }
    extractKeyFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.substring(1);
        }
        catch (error) {
            throw new Error('Invalid S3 URL format');
        }
    }
    static validateConfiguration() {
        const issues = [];
        if (!process.env.MY_AWS_ACCESS_KEY_ID) {
            issues.push('MY_AWS_ACCESS_KEY_ID environment variable is missing');
        }
        if (!process.env.MY_AWS_SECRET_ACCESS_KEY) {
            issues.push('MY_AWS_SECRET_ACCESS_KEY environment variable is missing');
        }
        if (!process.env.MY_AWS_S3_BUCKET_NAME) {
            issues.push('MY_AWS_S3_BUCKET_NAME environment variable is missing');
        }
        if (!process.env.MY_AWS_REGION) {
            issues.push('MY_AWS_REGION environment variable is missing (will default to us-east-1)');
        }
        return {
            isValid: issues.length === 0,
            issues
        };
    }
    async testConnection() {
        try {
            const testKey = `test-connection-${Date.now()}.txt`;
            const testCommand = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: testKey,
                Body: Buffer.from('test connection'),
                ContentType: 'text/plain',
            });
            await this.s3Client.send(testCommand);
            const deleteCommand = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: testKey,
            });
            await this.s3Client.send(deleteCommand);
            return { success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    static validateFileType(mimetype) {
        const allowedTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif'
        ];
        return allowedTypes.includes(mimetype);
    }
    static validateFileSize(size, maxSize = 10 * 1024 * 1024) {
        return size <= maxSize;
    }
}
exports.default = S3Service;
