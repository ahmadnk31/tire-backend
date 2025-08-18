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
        this.s3Client = new client_s3_1.S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
        this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'tire-store-images';
    }
    async uploadFile({ file, filename, mimetype, folder = 'products' }) {
        try {
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
            return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
        }
        catch (error) {
            console.error('Error uploading file to S3:', error);
            throw new Error('Failed to upload file');
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
