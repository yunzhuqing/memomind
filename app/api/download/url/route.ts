import { NextRequest, NextResponse } from 'next/server';
import Database from '@/lib/database';
import { uploadFileToS3, generateS3Key } from '@/lib/s3';
import { getFileType } from '@/lib/fileUtils';
import { generateThumbnail } from '@/lib/thumbnailGenerator';
import { mapFileToResponse } from '@/lib/entityMappers';
import path from 'path';

export async function POST(request: NextRequest) {
  let taskId: number | null = null;
  
  try {
    const body = await request.json();
    const { userId, url, directoryPath = '/', filename } = body;

    if (!userId || !url) {
      return NextResponse.json(
        { error: 'userId and url are required' },
        { status: 400 }
      );
    }

    // Validate URL
    let downloadUrl: URL;
    try {
      downloadUrl = new URL(url);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // Extract filename from URL or use provided filename
    let originalFilename = filename;
    if (!originalFilename) {
      const urlPath = downloadUrl.pathname;
      originalFilename = path.basename(urlPath) || 'downloaded_file';
      // Decode URL-encoded filename
      originalFilename = decodeURIComponent(originalFilename);
    }

    // Create task record
    const task = await Database.createTask({
      userId: parseInt(userId),
      type: 'download',
      name: originalFilename,
      status: 'processing',
      filePath: directoryPath,
      metadata: { url },
    });
    taskId = task.id;

    // Download file
    console.log(`Downloading from URL: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    // Get content type and size
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const totalSize = contentLength ? parseInt(contentLength) : 0;

    // Update task with total size
    if (totalSize > 0) {
      await Database.updateTask(taskId, parseInt(userId), {
        totalSize,
      });
    }

    // Read response as buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Update progress
    await Database.updateTask(taskId, parseInt(userId), {
      progress: 50,
      downloadedSize: buffer.length,
    });

    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(originalFilename);
    const nameWithoutExt = path.basename(originalFilename, ext);
    const uniqueFilename = `${nameWithoutExt}_${timestamp}${ext}`;

    // Generate S3 key
    const s3Key = generateS3Key(userId, uniqueFilename, directoryPath);

    // Upload to S3
    await uploadFileToS3({
      file: buffer,
      key: s3Key,
      contentType,
    });

    // Update progress
    await Database.updateTask(taskId, parseInt(userId), {
      progress: 75,
    });

    // Determine file type
    const fileType = getFileType(contentType, ext);

    // Generate thumbnail for images and videos
    let thumbnailKey = null;
    if (fileType === 'image' || fileType === 'video') {
      try {
        const thumbnailResult = await generateThumbnail(
          buffer,
          originalFilename,
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
      }
    }

    // Save file metadata to database
    const fileRecord = await Database.createFile({
      userId: parseInt(userId),
      filename: uniqueFilename,
      originalFilename,
      filePath: s3Key,
      fileType,
      fileSize: buffer.length,
      mimeType: contentType,
      directoryPath,
      thumbnailKey: thumbnailKey || undefined,
    });

    // Update task as completed
    await Database.updateTask(taskId, parseInt(userId), {
      status: 'completed',
      progress: 100,
      downloadedSize: buffer.length,
    });

    return NextResponse.json({
      success: true,
      file: mapFileToResponse(fileRecord),
      taskId,
      message: 'File downloaded successfully',
    });
  } catch (error) {
    console.error('URL download error:', error);
    
    // Update task as failed
    if (taskId) {
      try {
        const body = await request.json();
        const { userId } = body;
        if (userId) {
          await Database.updateTask(taskId, parseInt(userId), {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } catch (updateError) {
        console.error('Failed to update task status:', updateError);
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download file' },
      { status: 500 }
    );
  }
}
