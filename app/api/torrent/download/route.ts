import { NextRequest, NextResponse } from 'next/server';
import parseTorrent from 'parse-torrent';
import Database from '@/lib/database';
import { generateS3Key, uploadStreamToS3 } from '@/lib/s3';
import { getFileType, getMimeType } from '@/lib/fileUtils';
import { Readable } from 'stream';
import path from 'path';

// Store active torrent engines
const torrentEngines = new Map<string, any>();

// Async function to handle the actual torrent download
async function performTorrentDownload(
  taskId: number,
  userId: string,
  torrentSource: any,
  selectedFiles: number[],
  directoryPath: string,
  sessionId: string
): Promise<void> {
  // Dynamically import torrent-stream
  const torrentStream = (await import('torrent-stream')).default;

  return new Promise<void>((resolve, reject) => {
    const engine = torrentStream(torrentSource);
    torrentEngines.set(sessionId, engine);

    engine.on('ready', async () => {
      try {
        // Update task with total size
        const totalSize = engine.files.reduce((sum: number, file: any) => sum + file.length, 0);
        if (totalSize > 0) {
          await Database.updateTask(taskId, parseInt(userId), {
            totalSize,
          });
        }

        const downloadedFiles: any[] = [];
        
        // Get files to download
        const filesToDownload = selectedFiles && selectedFiles.length > 0
          ? engine.files.filter((_: any, index: number) => selectedFiles.includes(index))
          : engine.files;

        // Deselect files not in selection
        if (selectedFiles && selectedFiles.length > 0) {
          engine.files.forEach((file: any, index: number) => {
            if (!selectedFiles.includes(index)) {
              file.deselect();
            }
          });
        }

        // Download each file with streaming upload to S3
        for (const file of filesToDownload) {
          try {
            // Generate unique filename
            const timestamp = Date.now();
            const ext = path.extname(file.name);
            const nameWithoutExt = path.basename(file.name, ext);
            const uniqueFilename = `${nameWithoutExt}_${timestamp}${ext}`;
            
            // Generate S3 key
            const s3Key = generateS3Key(userId, uniqueFilename, directoryPath);
            
            // Create readable stream from torrent file
            const torrentStream = file.createReadStream();
            
            // Convert to Node.js Readable stream
            const readableStream = new Readable({
              read() {
                // This will be handled by the torrent stream events
              }
            });

            torrentStream.on('data', (chunk: Buffer) => {
              readableStream.push(chunk);
            });

            torrentStream.on('end', () => {
              readableStream.push(null); // Signal end of stream
            });

            torrentStream.on('error', (error: Error) => {
              readableStream.destroy(error);
            });

            // Determine MIME type based on file extension
            const mimeType = getMimeType(ext);
            
            // Upload to S3 using the common stream upload method
            await uploadStreamToS3(s3Key, readableStream, mimeType);

            // Determine file type
            const fileType = getFileType(mimeType, ext);

            // Save to database using ORM
            const fileRecord = await Database.createFile({
              userId: parseInt(userId),
              filename: uniqueFilename,
              originalFilename: file.name,
              filePath: s3Key,
              fileType,
              fileSize: file.length,
              mimeType,
              directoryPath,
            });

            downloadedFiles.push(fileRecord);
            console.log(`File uploaded to S3: ${file.name} (${file.length} bytes)`);
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
          }
        }

        // Update task as completed
        await Database.updateTask(taskId, parseInt(userId), {
          status: 'completed',
          progress: 100,
          downloadedSize: totalSize,
        });

        // Clean up
        engine.destroy(() => {
          torrentEngines.delete(sessionId);
        });

        console.log(`Torrent download completed: ${downloadedFiles.length} file(s)`);
        resolve();
      } catch (error) {
        console.error('Error in torrent download:', error);
        
        // Update task as failed
        await Database.updateTask(taskId, parseInt(userId), {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        engine.destroy(() => {
          torrentEngines.delete(sessionId);
        });
        
        reject(error);
      }
    });

    engine.on('error', async (error: Error) => {
      console.error('Engine error:', error);
      
      // Update task as failed
      await Database.updateTask(taskId, parseInt(userId), {
        status: 'failed',
        errorMessage: error.message,
      });

      engine.destroy(() => {
        torrentEngines.delete(sessionId);
      });
      
      reject(error);
    });
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { 
      userId, 
      magnetUri, 
      torrentFile, 
      selectedFiles, 
      directoryPath = '/',
      torrentName = 'Unknown Torrent'
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!magnetUri && !torrentFile) {
      return NextResponse.json(
        { error: 'Magnet URI or torrent file is required' },
        { status: 400 }
      );
    }

    // Parse torrent to get info
    let torrentInfo: any;
    try {
      const torrentSource = torrentFile 
        ? Buffer.from(torrentFile, 'base64')
        : magnetUri;
      torrentInfo = await parseTorrent(torrentSource);
    } catch (error) {
      console.error('Error parsing torrent:', error);
    }

    // Create task record using ORM
    const task = await Database.createTask({
      userId: parseInt(userId),
      type: 'torrent',
      name: torrentInfo?.name || torrentName,
      status: 'processing',
      filePath: directoryPath,
      metadata: {
        infoHash: torrentInfo?.infoHash,
        magnetUri: magnetUri || null,
        selectedFiles: selectedFiles || [],
      },
    });

    const taskId = task.id;

    // Create a unique session ID for this download
    const sessionId = `torrent_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Add torrent source
    const torrentSource = torrentFile 
      ? Buffer.from(torrentFile, 'base64')
      : magnetUri;

    // Start download in background (don't await)
    performTorrentDownload(
      taskId,
      userId,
      torrentSource,
      selectedFiles || [],
      directoryPath,
      sessionId
    ).catch(error => {
      console.error('Background torrent download error:', error);
    });

    // Return immediately
    return NextResponse.json({
      success: true,
      sessionId,
      taskId,
      message: 'Torrent download started',
    });
  } catch (error) {
    console.error('Error starting torrent download:', error);
    return NextResponse.json(
      { error: 'Failed to start torrent download' },
      { status: 500 }
    );
  }
}

// GET - Get download progress
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const engine = torrentEngines.get(sessionId);
    if (!engine) {
      return NextResponse.json({
        success: true,
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        status: 'not_found',
      });
    }

    // Calculate total size from all files
    const totalSize = engine.files.reduce((sum: number, file: any) => sum + file.length, 0);
    
    return NextResponse.json({
      success: true,
      progress: engine.swarm && totalSize > 0 ? engine.swarm.downloaded / totalSize : 0,
      downloadSpeed: engine.swarm ? engine.swarm.downloadSpeed() : 0,
      uploadSpeed: engine.swarm ? engine.swarm.uploadSpeed() : 0,
      numPeers: engine.swarm ? engine.swarm.wires.length : 0,
      downloaded: engine.swarm ? engine.swarm.downloaded : 0,
      uploaded: engine.swarm ? engine.swarm.uploaded : 0,
      status: 'downloading',
    });
  } catch (error) {
    console.error('Error getting torrent progress:', error);
    return NextResponse.json(
      { error: 'Failed to get progress' },
      { status: 500 }
    );
  }
}
