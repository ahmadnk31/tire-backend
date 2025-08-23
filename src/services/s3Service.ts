import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';


interface UploadParams {
  file: Buffer;
  filename: string;
  mimetype: string;
  folder?: string;
}

interface PresignedUrlParams {
  key: string;
  expiresIn?: number;
}

class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // Log configuration for debugging (without sensitive data)
    console.log('🔧 S3Service Configuration:', {
      region: process.env.MY_AWS_REGION || 'us-east-1',
      bucket: process.env.MY_AWS_S3_BUCKET_NAME || 'ariana-tire',
      hasAccessKey: !!process.env.MY_AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.MY_AWS_SECRET_ACCESS_KEY,
    });

    this.s3Client = new S3Client({
      region: process.env.MY_AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.MY_AWS_S3_BUCKET_NAME || 'tire-store-images';
  }

  /**
   * Upload file to S3
   */
  async uploadFile({ file, filename, mimetype, folder = 'products' }: UploadParams): Promise<string> {
    try {
      console.log('📤 Starting S3 upload:', {
        filename,
        mimetype,
        folder,
        fileSize: file.length,
        bucketName: this.bucketName
      });

      const fileExtension = path.extname(filename);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const key = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;

      const command = new PutObjectCommand({
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

      // Use consistent region environment variable
      const region = process.env.MY_AWS_REGION || 'us-east-1';
      const imageUrl = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
      
      console.log('✅ S3 upload successful:', {
        key,
        imageUrl,
        originalFilename: filename
      });

      return imageUrl;
    } catch (error) {
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

      // ACL: 'public-read', // Removed for Object Ownership enforced buckets
  /**
   * Delete file from S3
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract key from URL
      const key = this.extractKeyFromUrl(fileUrl);
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Get presigned URL for private files
   */
  async getPresignedUrl({ key, expiresIn = 3600 }: PresignedUrlParams): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate presigned URL');
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(files: UploadParams[]): Promise<string[]> {
    try {
      const uploadPromises = files.map(file => this.uploadFile(file));
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple files:', error);
      throw new Error('Failed to upload files');
    }
  }

  /**
   * Extract S3 key from URL
   */
  private extractKeyFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch (error) {
      throw new Error('Invalid S3 URL format');
    }
  }

  /**
   * Validate S3 configuration
   */
  static validateConfiguration(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
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

  /**
   * Test S3 connection by attempting to list bucket
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to put a small test object
      const testKey = `test-connection-${Date.now()}.txt`;
      const testCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
        Body: Buffer.from('test connection'),
        ContentType: 'text/plain',
      });
      
      await this.s3Client.send(testCommand);
      
      // Clean up test object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
      });
      
      await this.s3Client.send(deleteCommand);
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Validate file type
   */
  static validateFileType(mimetype: string): boolean {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    return allowedTypes.includes(mimetype);
  }

  /**
   * Validate file size (in bytes)
   */
  static validateFileSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean { // 10MB default
    return size <= maxSize;
  }
}

export default S3Service;
