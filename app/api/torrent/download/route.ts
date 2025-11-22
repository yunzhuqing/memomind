import { NextRequest, NextResponse } from 'next/server';
import parseTorrent from 'parse-torrent';
import pool from '@/lib/db';
import { uploadFileToS3, generateS3Key } from '@/lib/s3';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

// Store active torrent engines
const torrentEngines = new Map<string, any>();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { 
      userId, 
      magnetUri, 
      torrentFile, 
      selectedFiles, 
      directoryPath = '/' 
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

    // Create a unique session ID for this download
    const sessionId = `torrent_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Dynamically import torrent-stream
    const torrentStream = (await import('torrent-stream')).default;

    // Add torrent
    const torrentSource = torrentFile 
      ? Buffer.from(torrentFile, 'base64')
      : magnetUri;

    return new Promise<NextResponse>((resolve) => {
      const engine = torrentStream(torrentSource);
      torrentEngines.set(sessionId, engine);

      engine.on('ready', async () => {
        try {
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

          // Download each file
          for (const file of filesToDownload) {
            await new Promise<void>((resolveFile) => {
              const chunks: Buffer[] = [];
              const stream = file.createReadStream();

              stream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
              });

              stream.on('end', async () => {
                try {
                  const buffer = Buffer.concat(chunks);
                  
                  // Generate S3 key and upload
                  const s3Key = generateS3Key(userId, file.name, directoryPath);
                  await uploadFileToS3({
                    file: buffer,
                    key: s3Key,
                    contentType: 'application/octet-stream'
                  });

                  // Save to database
                  const result = await pool.query(
                    `INSERT INTO files (user_id, filename, original_filename, file_type, file_size, directory_path, s3_key)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING id, filename, original_filename, file_type, file_size, directory_path, created_at`,
                    [
                      userId,
                      s3Key,
                      file.name,
                      getFileType(file.name),
                      file.length,
                      directoryPath,
                      s3Key,
                    ]
                  );

                  downloadedFiles.push(result.rows[0]);
                } catch (error) {
                  console.error('Error processing file:', error);
                }
                
                resolveFile();
              });

              stream.on('error', (error: Error) => {
                console.error('Stream error:', error);
                resolveFile();
              });
            });
          }

          // Clean up
          engine.destroy(() => {
            torrentEngines.delete(sessionId);
          });

          resolve(
            NextResponse.json({
              success: true,
              sessionId,
              files: downloadedFiles,
              message: `Downloaded ${downloadedFiles.length} file(s)`,
            })
          );
        } catch (error) {
          console.error('Error in torrent download:', error);
          engine.destroy(() => {
            torrentEngines.delete(sessionId);
          });
          
          resolve(
            NextResponse.json(
              { error: 'Failed to download torrent files' },
              { status: 500 }
            )
          );
        }
      });

      engine.on('error', (error: Error) => {
        console.error('Engine error:', error);
        engine.destroy(() => {
          torrentEngines.delete(sessionId);
        });
        
        resolve(
          NextResponse.json(
            { error: 'Failed to start torrent download: ' + error.message },
            { status: 500 }
          )
        );
      });
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

    return NextResponse.json({
      success: true,
      progress: engine.swarm ? engine.swarm.downloaded / engine.torrent.length : 0,
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

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'];
  const textExts = ['txt', 'log', 'csv'];
  
  if (imageExts.includes(ext || '')) return 'image';
  if (videoExts.includes(ext || '')) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md') return 'markdown';
  if (textExts.includes(ext || '')) return 'text';
  
  return 'other';
}
