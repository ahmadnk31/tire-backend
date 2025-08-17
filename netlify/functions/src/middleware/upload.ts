import multer from 'multer';
import S3Service from '../services/s3Service';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Validate file type
  if (!S3Service.validateFileType(file.mimetype)) {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF files are allowed.'));
    return;
  }
  cb(null, true);
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Maximum 10 files at once
  },
});

// Error handling middleware for multer
export const handleMulterError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
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
