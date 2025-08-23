"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const upload_1 = require("../middleware/upload");
const s3Service_1 = __importDefault(require("../services/s3Service"));
const addCorsHeaders = (res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
};
const router = express_1.default.Router();
const s3Service = new s3Service_1.default();
router.options('*', (req, res) => {
    addCorsHeaders(res);
    res.status(200).end();
});
router.post('/single', upload_1.upload.single('image'), async (req, res) => {
    try {
        addCorsHeaders(res);
        console.log('📤 Single upload request received:', {
            hasFile: !!req.file,
            bodyFolder: req.body?.folder,
            headers: req.headers['content-type'],
            origin: req.headers.origin,
            userAgent: req.headers['user-agent']
        });
        if (!req.file) {
            console.log('❌ No file in request');
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log('📋 File details:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            hasBuffer: !!req.file.buffer
        });
        const folder = req.body.folder || 'products';
        const imageUrl = await s3Service.uploadFile({
            file: req.file.buffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            folder
        });
        console.log('✅ Upload successful:', { imageUrl });
        res.json({
            success: true,
            message: 'File uploaded successfully',
            imageUrl,
            originalName: req.file.originalname,
            size: req.file.size
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Upload error:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            hasFile: !!req.file,
            hasS3Service: !!s3Service
        });
        res.status(500).json({
            error: 'Failed to upload file',
            details: errorMessage
        });
    }
});
router.post('/multiple', upload_1.upload.array('images', 10), async (req, res) => {
    try {
        addCorsHeaders(res);
        console.log('📤 Multiple upload request received:', {
            hasFiles: !!req.files,
            filesCount: Array.isArray(req.files) ? req.files.length : 0,
            bodyFolder: req.body?.folder,
            origin: req.headers.origin,
            userAgent: req.headers['user-agent']
        });
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            console.log('❌ No files in request');
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const folder = req.body.folder || 'products';
        const files = req.files;
        console.log('📋 Files details:', files.map(f => ({
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size
        })));
        const uploadParams = files.map(file => ({
            file: file.buffer,
            filename: file.originalname,
            mimetype: file.mimetype,
            folder
        }));
        const imageUrls = await s3Service.uploadMultipleFiles(uploadParams);
        console.log('✅ Multiple upload successful:', { count: imageUrls.length });
        res.json({
            success: true,
            message: `${imageUrls.length} files uploaded successfully`,
            results: imageUrls.map((imageUrl, index) => ({
                imageUrl,
                originalName: files[index].originalname,
                size: files[index].size
            }))
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Multiple upload error:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            filesCount: Array.isArray(req.files) ? req.files.length : 0
        });
        res.status(500).json({
            error: 'Failed to upload files',
            details: errorMessage
        });
    }
});
router.delete('/delete', async (req, res) => {
    try {
        const { imageUrl } = req.query;
        if (!imageUrl || typeof imageUrl !== 'string') {
            return res.status(400).json({ error: 'imageUrl is required' });
        }
        await s3Service.deleteFile(imageUrl);
        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});
router.get('/presigned-url', async (req, res) => {
    try {
        const { fileName, folder = 'products' } = req.query;
        if (!fileName || typeof fileName !== 'string') {
            return res.status(400).json({ error: 'fileName is required' });
        }
        const key = folder ? `${folder}/${fileName}` : fileName;
        const presignedUrl = await s3Service.getPresignedUrl({ key });
        res.json({
            success: true,
            presignedUrl,
            key,
            fileName
        });
    }
    catch (error) {
        console.error('Presigned URL error:', error);
        res.status(500).json({ error: 'Failed to generate presigned URL' });
    }
});
router.get('/test-s3', async (req, res) => {
    try {
        console.log('🔧 Testing S3 configuration...');
        const configValidation = s3Service_1.default.validateConfiguration();
        if (!configValidation.isValid) {
            return res.status(500).json({
                success: false,
                error: 'S3 configuration issues detected',
                issues: configValidation.issues
            });
        }
        const connectionTest = await s3Service.testConnection();
        if (!connectionTest.success) {
            return res.status(500).json({
                success: false,
                error: 'S3 connection failed',
                details: connectionTest.error
            });
        }
        res.json({
            success: true,
            message: 'S3 configuration and connection are working properly',
            config: {
                region: process.env.MY_AWS_REGION || 'us-east-1',
                bucket: process.env.MY_AWS_S3_BUCKET_NAME,
                hasCredentials: !!(process.env.MY_AWS_ACCESS_KEY_ID && process.env.MY_AWS_SECRET_ACCESS_KEY)
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ S3 test error:', errorMessage);
        res.status(500).json({
            success: false,
            error: 'Failed to test S3 configuration',
            details: errorMessage
        });
    }
});
exports.default = router;
