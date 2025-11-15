import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { uploadFileToS3, generateS3Key } from '@/lib/s3';
import pool from '@/lib/db';
import { getFileType } from '@/lib/fileUtils';
import { generateThumbnail } from '@/lib/thumbnailGenerator';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const directoryPath = (formData.get('directoryPath') as string) || '/';

    if (!file || !userId) {
      return NextResponse.json(
        { error: 'File and userId are required' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const filename = `${nameWithoutExt}_${timestamp}${ext}`;

    // Generate S3 key
    const s3Key = generateS3Key(userId, filename, directoryPath);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3
    const s3Url = await uploadFileToS3({
      file: buffer,
      key: s3Key,
      contentType: file.type,
    });

    // Determine file type
    const fileType = getFileType(file.type, ext);

    // Generate thumbnail for images and videos
    let thumbnailKey = null;
    if (fileType === 'image' || fileType === 'video') {
      try {
        const thumbnailResult = await generateThumbnail(
          buffer,
          originalName,
          fileType,
          s3Key,
          userId
        );
        if (thumbnailResult) {
          thumbnailKey = thumbnailResult.thumbnailKey;
          console.log(`Thumbnail generated: ${thumbnailKey}`);
        }
      } catch (error) {
        console.error('Failed to generate thumbnail:', error);
        // Continue without thumbnail - non-critical error
      }
    }

    // Save file metadata to database
    const result = await pool.query(
      `INSERT INTO files (user_id, filename, original_filename, file_path, file_type, file_size, mime_type, directory_path, thumbnail_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        filename,
        originalName,
        s3Key, // Store S3 key instead of local path
        fileType,
        file.size,
        file.type,
        directoryPath,
        thumbnailKey,
      ]
    );

    return NextResponse.json({
      success: true,
      file: {
        ...result.rows[0],
        s3_url: s3Url,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
