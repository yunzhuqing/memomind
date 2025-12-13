import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

// Initialize S3 client
const region = process.env.AWS_REGION || 'us-east-1';

export const s3Client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  // Explicitly set the endpoint for the region to avoid redirect issues
  endpoint: `https://s3.${region}.amazonaws.com`,
  // Force path-style URLs to avoid bucket name resolution issues
  forcePathStyle: false,
  // Use regional endpoint to avoid redirect issues
  useAccelerateEndpoint: false,
});

export const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';

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

/**
 * Initiate multipart upload
 */
export async function initiateMultipartUpload(key: string, contentType: string): Promise<string> {
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const response = await s3Client.send(command);
  return response.UploadId!;
}

/**
 * Upload a single part
 */
export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    Body: body,
  });

  const response = await s3Client.send(command);
  return response.ETag!;
}

/**
 * Complete multipart upload
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>
): Promise<string> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });

  await s3Client.send(command);
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

/**
 * Abort multipart upload
 */
export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
}

/**
 * List uploaded parts
 */
export async function listUploadedParts(key: string, uploadId: string): Promise<number[]> {
  const command = new ListPartsCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  });

  const response = await s3Client.send(command);
  return response.Parts?.map(part => part.PartNumber!) || [];
}

/**
 * Upload a stream to S3 using multipart upload
 * This is useful for large files or streaming data (e.g., torrent downloads)
 */
export async function uploadStreamToS3(
  key: string,
  stream: Readable,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: stream,
      ContentType: contentType,
    },
    queueSize: 4, // Number of concurrent parts
    partSize: 5 * 1024 * 1024, // 5MB per part (minimum for S3)
  });

  await upload.done();
  
  // Return the S3 URL
  return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
}
