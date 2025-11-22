import { NextRequest, NextResponse } from 'next/server';
import parseTorrent from 'parse-torrent';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const magnetUri = formData.get('magnetUri') as string;

    let torrentInfo;

    if (file) {
      // Parse torrent file
      const buffer = Buffer.from(await file.arrayBuffer());
      torrentInfo = await parseTorrent(buffer);
    } else if (magnetUri) {
      // Parse magnet URI
      torrentInfo = await parseTorrent(magnetUri);
    } else {
      return NextResponse.json(
        { error: 'Please provide either a torrent file or magnet URI' },
        { status: 400 }
      );
    }

    // Extract file information
    const torrentData = torrentInfo as any;
    let files = [];
    
    if (torrentData.files && torrentData.files.length > 0) {
      // Multi-file torrent
      files = torrentData.files.map((file: any, index: number) => ({
        index,
        name: file.name,
        path: file.path || file.name,
        length: file.length,
        offset: file.offset || 0,
      }));
    } else if (torrentData.name && torrentData.length) {
      // Single file torrent
      files = [{
        index: 0,
        name: torrentData.name,
        path: torrentData.name,
        length: torrentData.length,
        offset: 0,
      }];
    }

    // For magnet URIs, file information is not available until connected to peers
    const isMagnetUri = !file && magnetUri && magnetUri.trim().length > 0;

    return NextResponse.json({
      success: true,
      torrent: {
        name: torrentData.name || 'Unknown',
        infoHash: torrentData.infoHash,
        length: torrentData.length || 0,
        files,
        announce: torrentData.announce || [],
        // Indicate if this is from a magnet URI (file info not available)
        isMagnetUri,
        // Note for magnet URIs
        note: isMagnetUri && files.length === 0 
          ? 'File information is not available in magnet URIs. Connect to peers to retrieve file details.'
          : undefined,
      },
    });
  } catch (error) {
    console.error('Error parsing torrent:', error);
    return NextResponse.json(
      { error: 'Failed to parse torrent' },
      { status: 500 }
    );
  }
}
