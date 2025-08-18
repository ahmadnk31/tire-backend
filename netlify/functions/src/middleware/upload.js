"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMulterError = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const s3Service_1 = __importDefault(require("../services/s3Service"));
const storage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (!s3Service_1.default.validateFileType(file.mimetype)) {
        cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF files are allowed.'));
        return;
    }
    cb(null, true);
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10,
    },
});
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer_1.default.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    error: 'File too large. Maximum size is 10MB.',
                    code: 'FILE_TOO_LARGE'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    error: 'Too many files. Maximum is 10 files at once.',
                    code: 'TOO_MANY_FILES'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    error: 'Unexpected field name.',
                    code: 'UNEXPECTED_FIELD'
                });
            default:
                return res.status(400).json({
                    error: 'File upload error.',
                    code: 'UPLOAD_ERROR'
                });
        }
    }
    if (error.message.includes('Invalid file type')) {
        return res.status(400).json({
            error: error.message,
            code: 'INVALID_FILE_TYPE'
        });
    }
    next(error);
};
exports.handleMulterError = handleMulterError;
