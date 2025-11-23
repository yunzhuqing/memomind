import { NextRequest, NextResponse } from 'next/server';

// Store active metadata fetchers
const metadataFetchers = new Map<string, any>();

// Fetch metadata from magnet URI
async function fetchMetadata(magnetUri: string, sessionId: string): Promise<any> {
  // Dynamically import torrent-stream
  const torrentStream = (await import('torrent-stream')).default;

  return new Promise((resolve, reject) => {
    const engine = torrentStream(magnetUri, {
      // Only download metadata, not actual files
      tmp: '/tmp',
      path: '/tmp/torrent-metadata',
    });

    metadataFetchers.set(sessionId, engine);

    // Set timeout for metadata fetch (30 seconds)
    const timeout = setTimeout(() => {
      engine.destroy(() => {
        metadataFetchers.delete(sessionId);
      });
      reject(new Error('Metadata fetch timeout - unable to connect to peers'));
    }, 30000);

    engine.on('ready', () => {
      clearTimeout(timeout);

      try {
        // Extract file information
        const files = engine.files.map((file: any, index: number) => ({
          index,
          name: file.name,
          path: file.path || file.name,
          length: file.length,
          offset: file.offset || 0,
        }));

        // Calculate total length
        const totalLength = files.reduce((sum, file) => sum + file.length, 0);

        const metadata = {
          name: (engine as any).torrent?.name || 'Unknown',
          infoHash: engine.infoHash,
          length: totalLength,
          files,
          announce: (engine as any).torrent?.announce || [],
          pieceLength: (engine as any).torrent?.pieceLength,
          lastPieceLength: (engine as any).torrent?.lastPieceLength,
          pieces: (engine as any).torrent?.pieces ? (engine as any).torrent.pieces.length : 0,
        };

        // Deselect all files to prevent downloading
        engine.files.forEach((file: any) => {
          file.deselect();
        });

        // Keep engine alive for a bit in case user wants to download
        // It will be cleaned up after 5 minutes or when download starts
        setTimeout(() => {
          if (metadataFetchers.has(sessionId)) {
            engine.destroy(() => {
              metadataFetchers.delete(sessionId);
            });
          }
        }, 5 * 60 * 1000);

        resolve(metadata);
      } catch (error) {
        clearTimeout(timeout);
        engine.destroy(() => {
          metadataFetchers.delete(sessionId);
        });
        reject(error);
      }
    });

    engine.on('error', (error: Error) => {
      clearTimeout(timeout);
      engine.destroy(() => {
        metadataFetchers.delete(sessionId);
      });
      reject(error);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { magnetUri } = body;

    if (!magnetUri) {
      return NextResponse.json(
        { error: 'Magnet URI is required' },
        { status: 400 }
      );
    }

    // Validate magnet URI format
    if (!magnetUri.startsWith('magnet:?')) {
      return NextResponse.json(
        { error: 'Invalid magnet URI format' },
        { status: 400 }
      );
    }

    // Create session ID
    const sessionId = `metadata_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      // Fetch metadata from DHT/peers
      const metadata = await fetchMetadata(magnetUri, sessionId);

      return NextResponse.json({
        success: true,
        sessionId,
        torrent: metadata,
        message: 'Metadata fetched successfully',
      });
    } catch (error) {
      console.error('Error fetching metadata:', error);
      
      // Return partial info from magnet URI
      const parseTorrent = (await import('parse-torrent')).default;
      const basicInfo = await parseTorrent(magnetUri);

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metadata',
        torrent: {
          name: basicInfo.name || 'Unknown',
          infoHash: basicInfo.infoHash,
          announce: basicInfo.announce || [],
          files: [],
        },
        message: 'Could not fetch file list from peers. You can still download, but file selection is not available.',
      }, { status: 206 }); // 206 Partial Content
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process magnet URI' },
      { status: 500 }
    );
  }
}

// GET - Check metadata fetch progress
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

    const engine = metadataFetchers.get(sessionId);
    if (!engine) {
      return NextResponse.json({
        success: false,
        status: 'not_found',
        message: 'Metadata fetch session not found',
      });
    }

    return NextResponse.json({
      success: true,
      status: 'fetching',
      numPeers: engine.swarm ? engine.swarm.wires.length : 0,
      message: 'Fetching metadata from peers...',
    });
  } catch (error) {
    console.error('Error checking metadata progress:', error);
    return NextResponse.json(
      { error: 'Failed to check progress' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel metadata fetch
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const engine = metadataFetchers.get(sessionId);
    if (engine) {
      engine.destroy();
      metadataFetchers.delete(sessionId);
    }

    return NextResponse.json({
      success: true,
      message: 'Metadata fetch cancelled',
    });
  } catch (error) {
    console.error('Error cancelling metadata fetch:', error);
    return NextResponse.json(
      { error: 'Failed to cancel' },
      { status: 500 }
    );
  }
}
