import { NextRequest, NextResponse } from 'next/server';
import { getFileFromS3 } from '@/lib/s3';
import pool from '@/lib/db';
import { Readable } from 'stream';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');
    const thumbnail = searchParams.get('thumbnail'); // Check if thumbnail is requested

    if (!fileId || !userId) {
      return NextResponse.json(
        { error: 'fileId and userId are required' },
        { status: 400 }
      );
    }

    // Get file info from database
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

    // Determine which file to serve (thumbnail or original)
    let s3Key = file.file_path;
    let fileName = file.file_name;
    let contentType = file.file_type || 'application/octet-stream';
    
    // If thumbnail is requested and available, use thumbnail
    if (thumbnail === 'true' && file.thumbnail_key) {
      s3Key = file.thumbnail_key;
      fileName = `thumbnail_${fileName}`;
      contentType = 'image/jpeg'; // Thumbnails are typically JPEG
    }

    // Get file from S3
    const s3Response = await getFileFromS3({ key: s3Key });

    if (!s3Response) {
      return NextResponse.json(
        { error: 'Failed to retrieve file from storage' },
        { status: 500 }
      );
    }

    // Convert the S3 response body to a Web Stream
    const stream = s3Response.transformToWebStream();

    // Return the file as a streaming response
    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
