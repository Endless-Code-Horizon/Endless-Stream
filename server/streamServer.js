import http from 'http';
import path from 'path';
import os from 'os';
import fs from 'fs';
import torrentStream from 'torrent-stream';

const PORT = process.env.PORT || 4000;
const CACHE_DIR = path.join(os.tmpdir(), 'endless_stream_torrents');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create cache dir:', err.message);
  }
}

// Popular fast public BitTorrent trackers
const PUBLIC_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.bittor.pw:1337/announce',
  'udp://public.popcorn-tracker.org:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://explodie.org:6969/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://tracker.internetwarriors.net:1337/announce',
];

const activeTorrents = new Map();

function getMimeType(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/mp4'; // Modern Chrome & Edge handle H.264/AAC MKV with video/mp4 container
    case '.avi':
      return 'video/x-msvideo';
    case '.mov':
      return 'video/quicktime';
    default:
      return 'video/mp4';
  }
}

function isVideoFile(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return ['.mp4', '.mkv', '.webm', '.avi', '.m4v', '.mov', '.ts'].includes(ext);
}

function getOrCreateEngine(infoHash) {
  const cleanHash = infoHash.toLowerCase().trim();
  const existing = activeTorrents.get(cleanHash);
  if (existing) {
    existing.lastAccessed = Date.now();
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const magnetUri = `magnet:?xt=urn:btih:${cleanHash}&${PUBLIC_TRACKERS.map(
      (t) => `tr=${encodeURIComponent(t)}`
    ).join('&')}`;

    console.log(`[P2P Engine] Spawning swarm for infoHash: ${cleanHash}`);

    const engine = torrentStream(magnetUri, {
      path: CACHE_DIR,
      verify: false,
      connections: 100,
      uploads: 10,
    });

    const entry = {
      engine,
      infoHash: cleanHash,
      files: [],
      ready: false,
      selectedFile: null,
      lastAccessed: Date.now(),
    };

    activeTorrents.set(cleanHash, entry);

    const readyTimeout = setTimeout(() => {
      if (!entry.ready) {
        console.warn(`[P2P Engine] Metadata search ongoing for infoHash: ${cleanHash}`);
      }
    }, 45000);

    engine.on('ready', () => {
      clearTimeout(readyTimeout);
      entry.ready = true;
      entry.files = engine.files || [];

      // Find largest video file (or largest file overall)
      const videoFiles = entry.files.filter((f) => isVideoFile(f.name));
      const candidates = videoFiles.length > 0 ? videoFiles : entry.files;

      if (candidates.length > 0) {
        entry.selectedFile = candidates.reduce((prev, curr) =>
          curr.length > prev.length ? curr : prev
        );
        console.log(
          `[P2P Engine] Ready! Selected main video: "${entry.selectedFile.name}" (${(
            entry.selectedFile.length /
            (1024 * 1024)
          ).toFixed(1)} MB)`
        );
      }

      resolve(entry);
    });

    engine.on('error', (err) => {
      clearTimeout(readyTimeout);
      console.error(`[P2P Engine] Torrent error:`, err);
      reject(err);
    });

    // If metadata was already cached or resolves fast
    if (engine.files && engine.files.length > 0) {
      clearTimeout(readyTimeout);
      entry.ready = true;
      entry.files = engine.files;
      resolve(entry);
    }
  });
}

// Background cleanup: free inactive torrents after 30 minutes of idle
setInterval(() => {
  const now = Date.now();
  const IDLE_LIMIT = 30 * 60 * 1000;
  for (const [hash, entry] of activeTorrents.entries()) {
    if (now - entry.lastAccessed > IDLE_LIMIT) {
      console.log(`[P2P Engine] Destroying idle torrent: ${hash}`);
      try {
        entry.engine.destroy();
      } catch {}
      activeTorrents.delete(hash);
    }
  }
}, 5 * 60 * 1000);

const server = http.createServer(async (req, res) => {
  // Global CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Health check
  if (pathname === '/health' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        name: 'Endless Stream P2P Engine',
        activeTorrents: activeTorrents.size,
      })
    );
    return;
  }

  // 2. Swarm Stats: /stats/:infoHash
  if (pathname.startsWith('/stats/')) {
    const infoHash = pathname.split('/')[2];
    if (!infoHash) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing infoHash' }));
      return;
    }

    const cleanHash = infoHash.toLowerCase().trim();
    const entry = activeTorrents.get(cleanHash);

    if (!entry) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ infoHash: cleanHash, ready: false, peers: 0 }));
      return;
    }

    const swarm = entry.engine.swarm;
    const stats = {
      infoHash: cleanHash,
      ready: entry.ready,
      fileName: entry.selectedFile ? entry.selectedFile.name : null,
      fileSize: entry.selectedFile ? entry.selectedFile.length : 0,
      peers: swarm ? swarm.wires.length : 0,
      downloadSpeed: swarm ? swarm.downloadSpeed() : 0,
      uploadSpeed: swarm ? swarm.uploadSpeed() : 0,
      downloaded: swarm ? swarm.downloaded : 0,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
    return;
  }

  // 3. Video Stream: /stream/:infoHash/:fileIdx?
  if (pathname.startsWith('/stream/')) {
    const parts = pathname.slice('/stream/'.length).split('/');
    const infoHash = parts[0];
    const fileIdxParam = parts[1];

    if (!infoHash) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing infoHash');
      return;
    }

    try {
      const entry = await getOrCreateEngine(infoHash);
      entry.lastAccessed = Date.now();

      // Determine which file to stream
      let fileToStream = null;
      if (fileIdxParam !== undefined && fileIdxParam !== '') {
        const idx = parseInt(fileIdxParam, 10);
        if (!isNaN(idx) && entry.files[idx]) {
          fileToStream = entry.files[idx];
        }
      }

      if (!fileToStream) {
        fileToStream = entry.selectedFile || entry.files[0];
      }

      if (!fileToStream) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Torrent metadata resolving. Please retry in a moment.');
        return;
      }

      const totalSize = fileToStream.length;
      const mimeType = getMimeType(fileToStream.name);
      const range = req.headers.range;

      if (range) {
        // Parse HTTP Range header (e.g. "bytes=0-1048576" or "bytes=524288-")
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        if (isNaN(start) || start >= totalSize || end < start) {
          res.writeHead(416, {
            'Content-Range': `bytes */${totalSize}`,
            'Content-Type': 'text/plain',
          });
          res.end('Requested range not satisfiable');
          return;
        }

        const chunksize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mimeType,
        });

        const stream = fileToStream.createReadStream({ start, end });

        req.on('close', () => {
          stream.destroy();
        });

        stream.pipe(res);
      } else {
        // Full file stream request
        res.writeHead(200, {
          'Content-Length': totalSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': mimeType,
        });

        const stream = fileToStream.createReadStream();

        req.on('close', () => {
          stream.destroy();
        });

        stream.pipe(res);
      }
    } catch (err) {
      console.error('[P2P Engine] Stream handler error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Internal Streaming Error: ${err.message}`);
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ [Endless Stream] Native BitTorrent P2P Engine running on http://127.0.0.1:${PORT}`);
});
