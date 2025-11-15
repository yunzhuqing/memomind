import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { uploadFileToS3 } from './s3';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);

interface ThumbnailResult {
  thumbnailKey: string;
  thumbnailUrl: string;
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
 * Generate thumbnail for a video
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
