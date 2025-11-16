import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { uploadFileToS3, getDownloadUrl } from './s3';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import https from 'https';
import http from 'http';

const unlinkAsync = promisify(fs.unlink);

interface ThumbnailResult {
  thumbnailKey: string;
  thumbnailUrl: string;
}

/**
 * Download a partial range of a file from URL
 */
async function downloadPartialFile(url: string, outputPath: string, maxBytes: number = 10 * 1024 * 1024): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        
        // Stop downloading after maxBytes
        if (downloadedBytes >= maxBytes) {
          response.destroy();
          fileStream.end();
          resolve();
        } else {
          fileStream.write(chunk);
        }
      });

      response.on('end', () => {
        fileStream.end();
        resolve();
      });

      response.on('error', (error) => {
        fileStream.end();
        reject(error);
      });

      fileStream.on('error', (error) => {
        reject(error);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Generate thumbnail for an image
 */
export async function generateImageThumbnail(
  imageBuffer: Buffer,
  originalKey: string,
  userId: string
): Promise<ThumbnailResult> {
  try {
    // Generate thumbnail (max 400x400, maintain aspect ratio)
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Generate thumbnail key
    const thumbnailKey = generateThumbnailKey(originalKey);

    // Upload thumbnail to S3
    const thumbnailUrl = await uploadFileToS3({
      file: thumbnailBuffer,
      key: thumbnailKey,
      contentType: 'image/jpeg',
    });

    return {
      thumbnailKey,
      thumbnailUrl,
    };
  } catch (error) {
    console.error('Error generating image thumbnail:', error);
    throw error;
  }
}

/**
 * Generate thumbnail for a video (optimized - downloads only partial file)
 */
export async function generateVideoThumbnail(
  videoPath: string,
  originalKey: string,
  userId: string
): Promise<ThumbnailResult> {
  return new Promise(async (resolve, reject) => {
    const tempThumbnailPath = `/tmp/thumbnail-${Date.now()}.jpg`;

    try {
      // Extract frame at 1 second (or 10% of duration)
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['1'],
          filename: path.basename(tempThumbnailPath),
          folder: path.dirname(tempThumbnailPath),
          size: '400x400',
        })
        .on('end', async () => {
          try {
            // Read the generated thumbnail
            const thumbnailBuffer = fs.readFileSync(tempThumbnailPath);

            // Optimize with sharp
            const optimizedBuffer = await sharp(thumbnailBuffer)
              .resize(400, 400, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 80 })
              .toBuffer();

            // Generate thumbnail key
            const thumbnailKey = generateThumbnailKey(originalKey);

            // Upload thumbnail to S3
            const thumbnailUrl = await uploadFileToS3({
              file: optimizedBuffer,
              key: thumbnailKey,
              contentType: 'image/jpeg',
            });

            // Clean up temp file
            await unlinkAsync(tempThumbnailPath).catch(() => {});

            resolve({
              thumbnailKey,
              thumbnailUrl,
            });
          } catch (error) {
            // Clean up temp file on error
            await unlinkAsync(tempThumbnailPath).catch(() => {});
            reject(error);
          }
        })
        .on('error', async (error) => {
          // Clean up temp file on error
          await unlinkAsync(tempThumbnailPath).catch(() => {});
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate thumbnail for a video from S3 (optimized - downloads only partial file)
 */
export async function generateVideoThumbnailFromS3(
  s3Key: string,
  userId: string
): Promise<ThumbnailResult> {
  const tempVideoPath = `/tmp/video-partial-${Date.now()}.mp4`;
  
  try {
    // Get presigned URL for the video
    const videoUrl = await getDownloadUrl({ key: s3Key });
    
    // Download only first 10MB of video (enough for thumbnail generation)
    // This avoids downloading the entire video file
    await downloadPartialFile(videoUrl, tempVideoPath, 10 * 1024 * 1024);
    
    // Generate thumbnail from partial video
    const result = await generateVideoThumbnail(tempVideoPath, s3Key, userId);
    
    // Clean up temp video file
    await unlinkAsync(tempVideoPath).catch(() => {});
    
    return result;
  } catch (error) {
    // Clean up temp video file on error
    await unlinkAsync(tempVideoPath).catch(() => {});
    throw error;
  }
}

/**
 * Generate thumbnail key from original key
 */
function generateThumbnailKey(originalKey: string): string {
  const ext = path.extname(originalKey);
  const baseName = originalKey.substring(0, originalKey.length - ext.length);
  return `${baseName}_thumb.jpg`;
}

/**
 * Main function to generate thumbnail based on file type
 */
export async function generateThumbnail(
  fileBuffer: Buffer,
  filePath: string,
  fileType: string,
  originalKey: string,
  userId: string
): Promise<ThumbnailResult | null> {
  try {
    if (fileType === 'image') {
      return await generateImageThumbnail(fileBuffer, originalKey, userId);
    } else if (fileType === 'video') {
      // For video, we need to save to temp file first
      const tempVideoPath = `/tmp/video-${Date.now()}${path.extname(filePath)}`;
      fs.writeFileSync(tempVideoPath, fileBuffer);
      
      try {
        const result = await generateVideoThumbnail(tempVideoPath, originalKey, userId);
        // Clean up temp video file
        await unlinkAsync(tempVideoPath).catch(() => {});
        return result;
      } catch (error) {
        // Clean up temp video file on error
        await unlinkAsync(tempVideoPath).catch(() => {});
        throw error;
      }
    }
    
    // No thumbnail for other file types
    return null;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    // Return null if thumbnail generation fails (non-critical)
    return null;
  }
}

/**
 * Generate thumbnail from S3 file (optimized for large files)
 */
export async function generateThumbnailFromS3(
  s3Key: string,
  fileType: string,
  userId: string
): Promise<ThumbnailResult | null> {
  try {
    if (fileType === 'video') {
      // Use optimized method that downloads only partial video
      return await generateVideoThumbnailFromS3(s3Key, userId);
    }
    
    // For other types, return null (should use buffer-based method)
    return null;
  } catch (error) {
    console.error('Error generating thumbnail from S3:', error);
    return null;
  }
}
