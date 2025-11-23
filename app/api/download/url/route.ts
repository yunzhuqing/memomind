import { NextRequest, NextResponse } from 'next/server';
import Database from '@/lib/database';
import { uploadFileToS3, generateS3Key } from '@/lib/s3';
import { getFileType } from '@/lib/fileUtils';
import { generateThumbnail } from '@/lib/thumbnailGenerator';
import { mapFileToResponse } from '@/lib/entityMappers';
import path from 'path';

// Async function to handle the actual download
async function performDownload(
  taskId: number,
  userId: number,
  url: string,
  originalFilename: string,
  directoryPath: string
) {
  try {
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
      await Database.updateTask(taskId, userId, {
        totalSize,
      });
    }

    // Read response as buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Update progress
    await Database.updateTask(taskId, userId, {
      progress: 50,
      downloadedSize: buffer.length,
    });

    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(originalFilename);
    const nameWithoutExt = path.basename(originalFilename, ext);
    const uniqueFilename = `${nameWithoutExt}_${timestamp}${ext}`;

    // Generate S3 key
    const s3Key = generateS3Key(userId.toString(), uniqueFilename, directoryPath);

    // Upload to S3
    await uploadFileToS3({
      file: buffer,
      key: s3Key,
      contentType,
    });

    // Update progress
    await Database.updateTask(taskId, userId, {
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
          userId.toString()
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
      userId,
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
    await Database.updateTask(taskId, userId, {
      status: 'completed',
      progress: 100,
      downloadedSize: buffer.length,
    });

    console.log(`Download completed: ${originalFilename}`);
  } catch (error) {
    console.error('URL download error:', error);
    
    // Update task as failed
    await Database.updateTask(taskId, userId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function POST(request: NextRequest) {
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

    // Start download in background (don't await)
    performDownload(
      task.id,
      parseInt(userId),
      url,
      originalFilename,
      directoryPath
    ).catch(error => {
      console.error('Background download error:', error);
    });

    // Return immediately
    return NextResponse.json({
      success: true,
      taskId: task.id,
      message: 'Download started',
    });
  } catch (error) {
    console.error('Error starting download:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start download' },
      { status: 500 }
    );
  }
}
