import express, { Request, Response } from 'express';
import { upload } from '../middleware/upload.js';
import S3Service from '../services/s3Service.js';

const router = express.Router();
const s3Service = new S3Service();

interface MulterRequest extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

// Upload single image
router.post('/single', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folder = req.body.folder || 'products';
    const imageUrl = await s3Service.uploadFile({
      file: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      folder
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      imageUrl,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Upload multiple images
router.post('/multiple', upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const folder = req.body.folder || 'products';
    const files = req.files as Express.Multer.File[];
    
    const uploadParams = files.map(file => ({
      file: file.buffer,
      filename: file.originalname,
      mimetype: file.mimetype,
      folder
    }));
    
    const imageUrls = await s3Service.uploadMultipleFiles(uploadParams);

    res.json({
      success: true,
      message: `${imageUrls.length} files uploaded successfully`,
      results: imageUrls.map((imageUrl, index) => ({
        imageUrl,
        originalName: files[index].originalname,
        size: files[index].size
      }))
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Delete image
router.delete('/delete', async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Get presigned URL for direct upload
router.get('/presigned-url', async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Presigned URL error:', error);
    res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
});

export default router;
