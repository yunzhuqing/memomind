import { NextRequest, NextResponse } from 'next/server';
import { getDownloadUrl } from '@/lib/s3';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

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

    // Generate presigned URL for S3 download
    const downloadUrl = await getDownloadUrl({ key: file.file_path });

    // Redirect to the presigned URL
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
