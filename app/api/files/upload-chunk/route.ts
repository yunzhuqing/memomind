import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { 
  generateS3Key, 
  initiateMultipartUpload, 
  uploadPart, 
  completeMultipartUpload,
  abortMultipartUpload,
  listUploadedParts
} from '@/lib/s3';
import pool from '@/lib/db';
import { getFileType } from '@/lib/fileUtils';
import { generateThumbnailFromS3 } from '@/lib/thumbnailGenerator';

// Store upload sessions in memory (in production, use Redis or database)
const uploadSessions = new Map<string, {
  uploadId: string;
  key: string;
  parts: Array<{ PartNumber: number; ETag: string }>;
  userId: string;
  filename: string;
  originalFilename: string;
  fileType: string;
  mimeType: string;
  totalSize: number;
  directoryPath: string;
}>();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const action = formData.get('action') as string;

    // Initialize upload
    if (action === 'init') {
      const userId = formData.get('userId') as string;
      const filename = formData.get('filename') as string;
      const fileType = formData.get('fileType') as string;
      const totalSize = parseInt(formData.get('totalSize') as string);
      const directoryPath = (formData.get('directoryPath') as string) || '/';

      if (!userId || !filename || !fileType || !totalSize) {
        return NextResponse.json(
          { error: 'Missing required parameters' },
          { status: 400 }
        );
      }

      // Calculate chunk size and total chunks on server
      const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(filename);
      const nameWithoutExt = path.basename(filename, ext);
      const uniqueFilename = `${nameWithoutExt}_${timestamp}${ext}`;

      // Generate S3 key
      const s3Key = generateS3Key(userId, uniqueFilename, directoryPath);

      // Initiate multipart upload
      const uploadId = await initiateMultipartUpload(s3Key, fileType);

      // Check for existing parts (for resume)
      const uploadedParts = await listUploadedParts(s3Key, uploadId);

      // Create session
      const sessionId = `${userId}_${timestamp}`;
      uploadSessions.set(sessionId, {
        uploadId,
        key: s3Key,
        parts: [],
        userId,
        filename: uniqueFilename,
        originalFilename: filename,
        fileType: getFileType(fileType, ext),
        mimeType: fileType,
        totalSize,
        directoryPath,
      });

      return NextResponse.json({
        success: true,
        sessionId,
        uploadId,
        chunkSize: CHUNK_SIZE,
        totalChunks,
        uploadedParts, // Return already uploaded parts for resume
      });
    }

    // Upload chunk
    if (action === 'upload') {
      const sessionId = formData.get('sessionId') as string;
      const partNumber = parseInt(formData.get('partNumber') as string);
      const chunk = formData.get('chunk') as Blob;

      if (!sessionId || !partNumber || !chunk) {
        return NextResponse.json(
          { error: 'Missing required parameters' },
          { status: 400 }
        );
      }

      const session = uploadSessions.get(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 400 }
        );
      }

      // Convert chunk to buffer
      const bytes = await chunk.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Upload part
      const etag = await uploadPart(
        session.key,
        session.uploadId,
        partNumber,
        buffer
      );

      // Store part info
      session.parts.push({ PartNumber: partNumber, ETag: etag });

      return NextResponse.json({
        success: true,
        partNumber,
        etag,
      });
    }

    // Complete upload
    if (action === 'complete') {
      const sessionId = formData.get('sessionId') as string;

      if (!sessionId) {
        return NextResponse.json(
          { error: 'Missing sessionId' },
          { status: 400 }
        );
      }

      const session = uploadSessions.get(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 400 }
        );
      }

      // Sort parts by part number
      session.parts.sort((a, b) => a.PartNumber - b.PartNumber);

      // Complete multipart upload
      const s3Url = await completeMultipartUpload(
        session.key,
        session.uploadId,
        session.parts
      );

      // Generate thumbnail for videos (optimized - no full download needed)
      let thumbnailKey = null;
      if (session.fileType === 'video') {
        try {
          // Use optimized method that downloads only partial video (first 10MB)
          const thumbnailResult = await generateThumbnailFromS3(
            session.key,
            session.fileType,
            session.userId
          );
          
          if (thumbnailResult) {
            thumbnailKey = thumbnailResult.thumbnailKey;
            console.log(`Thumbnail generated for chunked upload (optimized): ${thumbnailKey}`);
          }
        } catch (error) {
          console.error('Failed to generate thumbnail for chunked upload:', error);
          // Continue without thumbnail - non-critical error
        }
      }
      // Note: For images uploaded via chunks, thumbnail generation is skipped
      // as it would require downloading the full file. Consider generating
      // thumbnails on the client side for large images if needed.

      // Save file metadata to database
      const result = await pool.query(
        `INSERT INTO files (user_id, filename, original_filename, file_path, file_type, file_size, mime_type, directory_path, thumbnail_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          session.userId,
          session.filename,
          session.originalFilename,
          session.key,
          session.fileType,
          session.totalSize,
          session.mimeType,
          session.directoryPath,
          thumbnailKey,
        ]
      );

      // Clean up session
      uploadSessions.delete(sessionId);

      return NextResponse.json({
        success: true,
        file: {
          ...result.rows[0],
          s3_url: s3Url,
        },
      });
    }

    // Abort upload
    if (action === 'abort') {
      const sessionId = formData.get('sessionId') as string;

      if (!sessionId) {
        return NextResponse.json(
          { error: 'Missing sessionId' },
          { status: 400 }
        );
      }

      const session = uploadSessions.get(sessionId);
      if (session) {
        await abortMultipartUpload(session.key, session.uploadId);
        uploadSessions.delete(sessionId);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Chunk upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process chunk upload' },
      { status: 500 }
    );
  }
}
