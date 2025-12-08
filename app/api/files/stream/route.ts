import { NextRequest, NextResponse } from 'next/server';
import { s3Client } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import pool from '@/lib/db';

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from middleware headers
    const authUserId = request.headers.get('x-user-id');
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

    if (!fileId || !userId) {
      return NextResponse.json(
        { error: 'fileId and userId are required' },
        { status: 400 }
      );
    }

    // Validate user access
    if (authUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get file info from database (includes file_size and file_type)
    const result = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const file = result.rows[0];
    const s3Key = file.file_path;
    const fileSize = file.file_size; // Use file size from database
    const contentType = file.file_type === 'video' 
      ? 'video/mp4' // Default to mp4, adjust based on actual file extension if needed
      : 'application/octet-stream';

    // Get the Range header from the request
    const range = request.headers.get('range');

    // If no range is requested, return initial chunk for faster start
    if (!range) {
      // For videos, return first 5MB to start playback quickly
      const initialChunkSize = Math.min(5 * 1024 * 1024, fileSize);
      
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Range: `bytes=0-${initialChunkSize - 1}`,
      });

      const response = await s3Client.send(command);
      const stream = response.Body as any;

      return new NextResponse(stream, {
        status: 206, // Partial Content for better browser handling
        headers: {
          'Content-Type': contentType,
          'Content-Length': initialChunkSize.toString(),
          'Content-Range': `bytes 0-${initialChunkSize - 1}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        },
      });
    }

    // Parse the range header
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 5 * 1024 * 1024 - 1, fileSize - 1);
    const chunkSize = end - start + 1;

    // Request the specific byte range from S3
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Range: `bytes=${start}-${end}`,
    });

    const response = await s3Client.send(command);
    const stream = response.Body as any;

    // Return the partial content with proper headers
    return new NextResponse(stream, {
      status: 206, // Partial Content
      headers: {
        'Content-Type': contentType,
        'Content-Length': chunkSize.toString(),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Error streaming file:', error);
    return NextResponse.json(
      { error: 'Failed to stream file' },
      { status: 500 }
    );
  }
}
