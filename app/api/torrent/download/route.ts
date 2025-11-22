import { NextRequest, NextResponse } from 'next/server';
import WebTorrent from 'webtorrent';
import parseTorrent from 'parse-torrent';
import pool from '@/lib/db';
import { uploadFileToS3, generateS3Key } from '@/lib/s3';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

// Store active torrent clients
const torrentClients = new Map<string, WebTorrent.Instance>();

export async function POST(request: NextRequest) {
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

    // Parse torrent to get info
    let torrentInfo;
    if (torrentFile) {
      const buffer = Buffer.from(torrentFile, 'base64');
      torrentInfo = await parseTorrent(buffer);
    } else {
      torrentInfo = await parseTorrent(magnetUri);
    }

    // Create WebTorrent client
    const client = new WebTorrent();
    torrentClients.set(sessionId, client);

    // Add torrent
    const torrentSource = torrentFile 
      ? Buffer.from(torrentFile, 'base64')
      : magnetUri;

    return new Promise((resolve) => {
      client.add(torrentSource, { path: `/tmp/${sessionId}` }, async (torrent) => {
        try {
          // Filter files based on selection
          const filesToDownload = selectedFiles && selectedFiles.length > 0
            ? torrent.files.filter((file: any, index: number) => selectedFiles.includes(index))
            : torrent.files;

          // Deselect files not in selection
          if (selectedFiles && selectedFiles.length > 0) {
            torrent.files.forEach((file: any, index: number) => {
              if (!selectedFiles.includes(index)) {
                file.deselect();
              }
            });
          }

          const downloadedFiles: any[] = [];

          // Wait for files to download
          for (const file of filesToDownload) {
            await new Promise<void>((resolveFile) => {
              const filePath = path.join('/tmp', sessionId, file.path);
              
              file.getBuffer(async (err: string | Error | undefined, buffer?: Buffer) => {
                if (err || !buffer) {
                  console.error('Error downloading file:', err);
                  resolveFile();
                  return;
                }

                try {
                  // Ensure directory exists
                  const dir = path.dirname(filePath);
                  await mkdir(dir, { recursive: true });

                  // Write file to temp location
                  await writeFile(filePath, buffer);

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

                  // Clean up temp file
                  await unlink(filePath);
                } catch (error) {
                  console.error('Error processing file:', error);
                }

                resolveFile();
              });
            });
          }

          // Clean up
          client.destroy();
          torrentClients.delete(sessionId);

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
          client.destroy();
          torrentClients.delete(sessionId);
          
          resolve(
            NextResponse.json(
              { error: 'Failed to download torrent files' },
              { status: 500 }
            )
          );
        }
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

    const client = torrentClients.get(sessionId);
    if (!client || client.torrents.length === 0) {
      return NextResponse.json({
        success: true,
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        status: 'not_found',
      });
    }

    const torrent = client.torrents[0];

    return NextResponse.json({
      success: true,
      progress: torrent.progress,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      numPeers: torrent.numPeers,
      downloaded: torrent.downloaded,
      uploaded: torrent.uploaded,
      status: torrent.done ? 'completed' : 'downloading',
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
