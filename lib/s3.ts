import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';

export interface UploadFileParams {
  file: Buffer;
  key: string;
  contentType: string;
}

export interface DownloadFileParams {
  key: string;
}

export interface DeleteFileParams {
  key: string;
}

/**
 * Upload a file to S3
 */
export async function uploadFileToS3({ file, key, contentType }: UploadFileParams): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await s3Client.send(command);
  
  // Return the S3 URL
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

/**
 * Get a presigned URL for downloading a file from S3
 */
export async function getDownloadUrl({ key }: DownloadFileParams): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  // Generate presigned URL valid for 1 hour
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}

/**
 * Get file from S3 as a stream
 */
export async function getFileFromS3({ key }: DownloadFileParams) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  return response.Body;
}

/**
 * Delete a file from S3
 */
export async function deleteFileFromS3({ key }: DeleteFileParams): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Generate S3 key for a file
 */
export function generateS3Key(userId: string, filename: string, directoryPath: string = '/'): string {
  // Clean directory path
  const cleanPath = directoryPath === '/' ? '' : directoryPath.replace(/^\//, '');
  
  // Create key: users/{userId}/{directoryPath}/{filename}
  const parts = ['users', userId];
  if (cleanPath) {
    parts.push(cleanPath);
  }
  parts.push(filename);
  
  return parts.join('/');
}
