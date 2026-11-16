import path from 'path';
import os from 'os';
import fs from 'fs';
import { spawn } from 'child_process';
import torrentStream from 'torrent-stream';

const CACHE_DIR = path.join(os.tmpdir(), 'endless_stream_torrents');

if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.warn('[P2P Engine] Could not create cache dir:', err.message);
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
      return 'video/x-matroska';
    case '.avi':
      return 'video/x-msvideo';
    case '.mov':
      return 'video/quicktime';
    case '.ts':
      return 'video/mp2t';
    default:
      return 'video/mp4';
  }
}

function isVideoFile(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return ['.mp4', '.mkv', '.webm', '.avi', '.m4v', '.mov', '.ts', '.vob', '.wmv', '.flv'].includes(ext);
}

async function waitForHeadChunks(filePath, targetBytes = 1024 * 1024, timeoutMs = 30000, isCancelled = () => false) {
  const startTime = Date.now();
  const minRequired = Math.min(targetBytes, 256 * 1024);

  while (Date.now() - startTime < timeoutMs) {
    if (isCancelled()) {
      throw new Error('Client disconnected while waiting for media chunks');
    }
    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.size >= targetBytes) {
          return true;
        }
        if (stat.size >= minRequired && Date.now() - startTime > 2500) {
          return true;
        }
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Final check before timeout
  if (fs.existsSync(filePath)) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 0) return true;
    } catch {}
  }

  throw new Error(`Timeout waiting for initial head chunks on disk: ${filePath}`);
}

export function getOrCreateEngine(infoHash) {
  const cleanHash = infoHash.toLowerCase().trim();
  const existing = activeTorrents.get(cleanHash);
  if (existing) {
    existing.lastAccessed = Date.now();
    return existing.readyPromise;
  }

  const magnetUri = `magnet:?xt=urn:btih:${cleanHash}&${PUBLIC_TRACKERS.map(
    (t) => `tr=${encodeURIComponent(t)}`
  ).join('&')}`;

  console.log(`[P2P Engine] Spawning BitTorrent swarm for infoHash: ${cleanHash}`);

  const engine = torrentStream(magnetUri, {
    path: CACHE_DIR,
    verify: false,
    connections: 120,
    uploads: 10,
  });

  const entry = {
    engine,
    infoHash: cleanHash,
    files: [],
    ready: false,
    selectedFile: null,
    lastAccessed: Date.now(),
    readyPromise: null,
  };

  entry.readyPromise = new Promise((resolve, reject) => {
    let settled = false;

    const readyTimeout = setTimeout(() => {
      if (!settled && !entry.ready) {
        console.warn(`[P2P Engine] Metadata search taking longer for infoHash: ${cleanHash}`);
        if (engine.files && engine.files.length > 0) {
          onReady();
        } else {
          settled = true;
          reject(new Error('BitTorrent metadata search timed out. Looking for active seeders.'));
        }
      }
    }, 25000);

    const onReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(readyTimeout);

      entry.ready = true;
      entry.files = engine.files || [];

      // Find largest video file
      const videoFiles = entry.files.filter((f) => isVideoFile(f.name));
      const candidates = videoFiles.length > 0 ? videoFiles : entry.files;

      if (candidates.length > 0) {
        entry.selectedFile = candidates.reduce((prev, curr) =>
          curr.length > prev.length ? curr : prev
        );
        // Immediately start prioritized streaming download of this file (head & tail pieces)
        try {
          entry.selectedFile.select();
          if (engine.torrent) {
            const pieceLength = engine.torrent.pieceLength || 4194304;
            const startPiece = Math.floor(entry.selectedFile.offset / pieceLength);
            const endPiece = Math.floor(
              (entry.selectedFile.offset + entry.selectedFile.length - 1) / pieceLength
            );
            // Prioritize first 8 pieces for instant playback startup
            engine.select(startPiece, Math.min(endPiece, startPiece + 8), true);
            // Prioritize last 3 pieces for MP4 moov atom index resolution
            engine.select(Math.max(startPiece, endPiece - 2), endPiece, true);
          }
        } catch (err) {
          console.warn('[P2P Engine] Piece selection error:', err.message);
        }
        console.log(
          `[P2P Engine] Ready! Selected main video: "${entry.selectedFile.name}" (${(
            entry.selectedFile.length /
            (1024 * 1024)
          ).toFixed(1)} MB)`
        );
      }

      resolve(entry);
    };

    engine.on('ready', onReady);

    engine.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(readyTimeout);
      console.error(`[P2P Engine] Torrent error:`, err);
      reject(err);
    });

    if (engine.files && engine.files.length > 0) {
      onReady();
    }
  });

  activeTorrents.set(cleanHash, entry);

  // Trigger cache check on new torrent creation
  pruneCacheIfNeeded();

  return entry.readyPromise;
}

// 10GB LRU Cache Management
const MAX_CACHE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB limit
const PRUNE_TARGET_BYTES = 8.5 * 1024 * 1024 * 1024; // Prune target threshold

function formatBytesHelper(bytes) {
  if (!bytes || bytes <= 0) return '0 MB';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scanCacheFiles(dir) {
  let results = [];
  let total = 0;
  if (!fs.existsSync(dir)) return { total, results };

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const sub = scanCacheFiles(full);
        total += sub.total;
        results = results.concat(sub.results);
      } else if (ent.isFile()) {
        try {
          const stat = fs.statSync(full);
          total += stat.size;
          results.push({
            path: full,
            size: stat.size,
            atime: stat.atimeMs || stat.mtimeMs || 0,
            mtime: stat.mtimeMs || 0,
          });
        } catch {}
      }
    }
  } catch {}

  return { total, results };
}

export function pruneCacheIfNeeded() {
  try {
    const { total, results } = scanCacheFiles(CACHE_DIR);
    if (total <= MAX_CACHE_BYTES) return;

    console.log(`[P2P Cache] Disk cache size (${formatBytesHelper(total)}) exceeds 10 GB limit. Initiating LRU prune...`);

    const activePaths = new Set();
    for (const entry of activeTorrents.values()) {
      if (entry.files) {
        for (const f of entry.files) {
          if (f.path) activePaths.add(path.resolve(CACHE_DIR, f.path));
        }
      }
    }

    const pruneCandidates = results
      .filter((f) => !activePaths.has(path.resolve(f.path)))
      .sort((a, b) => (a.atime || a.mtime) - (b.atime || b.mtime));

    let currentTotal = total;
    let deletedCount = 0;

    for (const file of pruneCandidates) {
      if (currentTotal <= PRUNE_TARGET_BYTES) break;
      try {
        fs.unlinkSync(file.path);
        currentTotal -= file.size;
        deletedCount++;
      } catch {}
    }

    console.log(`[P2P Cache] LRU Prune complete. Removed ${deletedCount} files. New cache size: ${formatBytesHelper(currentTotal)}`);
  } catch (err) {
    console.warn('[P2P Cache] Prune error:', err.message);
  }
}

// Background cleanup: free inactive torrents after 30 minutes of idle & prune cache periodically
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
  pruneCacheIfNeeded();
}, 5 * 60 * 1000);

export function p2pMiddleware(req, res, next) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Global CORS Headers for video streaming
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Health check: /p2p-health
  if (pathname === '/p2p-health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        name: 'Endless Stream Native P2P Engine',
        activeTorrents: activeTorrents.size,
      })
    );
    return;
  }

  // 1b. Cache Telemetry & Health: /p2p-cache
  if (pathname === '/p2p-cache') {
    const { total, results } = scanCacheFiles(CACHE_DIR);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'active',
        maxBytes: MAX_CACHE_BYTES,
        maxFormatted: '10.0 GB',
        currentBytes: total,
        currentFormatted: formatBytesHelper(total),
        fileCount: results.length,
        activeSwarmCount: activeTorrents.size,
        cacheDir: CACHE_DIR,
      })
    );
    return;
  }

  // 2. Subtitles Proxy: /subtitles-proxy
  if (pathname === '/subtitles-proxy') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url param');
      return;
    }
    fetch(targetUrl)
      .then((r) => r.text())
      .then((text) => {
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(text);
      })
      .catch((err) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
    return;
  }

  // 2b. Universal Stremio Addon Proxy: /addon-proxy
  if (pathname === '/addon-proxy') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url param' }));
      return;
    }
    fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stremio/4.4.168',
        'Accept': 'application/json, text/plain, */*',
      },
    })
      .then(async (r) => {
        const text = await r.text();
        res.writeHead(r.status, {
          'Content-Type': r.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(text);
      })
      .catch((err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  // 3. Swarm Stats: /stats/:infoHash
  if (pathname.startsWith('/stats/')) {
    const rawHash = pathname.split('/')[2];
    if (!rawHash) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing infoHash' }));
      return;
    }

    const cleanHash = rawHash.toLowerCase().trim();
    const entry = activeTorrents.get(cleanHash);

    if (!entry) {
      getOrCreateEngine(cleanHash).catch(() => {});
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ infoHash: cleanHash, ready: false, peers: 0 }));
      return;
    }

    const swarm = entry.engine?.swarm;
    const stats = {
      infoHash: cleanHash,
      ready: Boolean(entry.ready),
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

  // 4. Video Stream: /stream/:infoHash/:fileIdx?
  if (pathname.startsWith('/stream/') || pathname.startsWith('/stream')) {
    const cleanPath = pathname.replace(/^\/stream\/?/, '');
    const parts = cleanPath.split('/');
    const infoHash = parts[0];
    const fileIdxParam = parts[1];

    if (!infoHash) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing infoHash');
      return;
    }

    let clientDisconnected = false;
    const onDisconnect = () => {
      clientDisconnected = true;
    };
    req.on('close', onDisconnect);
    res.on('close', onDisconnect);

    getOrCreateEngine(infoHash)
      .then(async (entry) => {
        if (clientDisconnected) return;
        entry.lastAccessed = Date.now();

        // Determine which file to stream (Must always be an actual video file, never text/nfo/subs)
        let fileToStream = null;
        if (fileIdxParam !== undefined && fileIdxParam !== '') {
          const idx = parseInt(fileIdxParam, 10);
          if (!isNaN(idx) && entry.files && entry.files[idx] && isVideoFile(entry.files[idx].name)) {
            fileToStream = entry.files[idx];
          }
        }

        if (!fileToStream) {
          fileToStream = entry.selectedFile || (entry.files && entry.files.find((f) => isVideoFile(f.name))) || (entry.files && entry.files[0]);
        }

        if (!fileToStream) {
          if (!res.headersSent && !clientDisconnected) {
            res.writeHead(503, { 'Content-Type': 'text/plain' });
            res.end('Torrent metadata resolving. Please retry in a moment.');
          }
          return;
        }

        const ext = path.extname(fileToStream.name || '').toLowerCase();
        const isNativePlayable = ['.mp4', '.m4v', '.webm'].includes(ext);
        const isRemuxRequested = url.searchParams.get('remux') === '1' || url.searchParams.get('transcode') === '1';
        const needsRemux = !isNativePlayable || isRemuxRequested;

        // A. ON-THE-FLY TRANSMUXING & REAL-TIME TRANSCODING
        // For MKV and other containers needing remuxing to fragmented MP4
        if (needsRemux) {
          const fullFilePath = path.resolve(CACHE_DIR, fileToStream.path || fileToStream.name || 'stream.mkv');
          const fileDir = path.dirname(fullFilePath);
          if (!fs.existsSync(fileDir)) {
            try {
              fs.mkdirSync(fileDir, { recursive: true });
            } catch {}
          }

          const startSecParam = url.searchParams.get('start') || url.searchParams.get('t');
          const startSeconds = startSecParam ? Math.max(0, parseFloat(startSecParam)) : 0;

          // Prioritize torrent piece downloading for target seek offset
          try {
            fileToStream.select();
            if (entry.engine && entry.engine.torrent && fileToStream.length > 0) {
              const pieceLength = entry.engine.torrent.pieceLength || 4194304;
              const estDuration = 3000;
              const estByteOffset = startSeconds > 0
                ? Math.min(
                    fileToStream.length - 1,
                    Math.max(0, Math.floor((startSeconds / estDuration) * fileToStream.length))
                  )
                : 0;
              const startPiece = Math.floor((fileToStream.offset + estByteOffset) / pieceLength);
              const maxPiece = Math.floor(
                (fileToStream.offset + fileToStream.length - 1) / pieceLength
              );
              entry.engine.select(startPiece, Math.min(maxPiece, startPiece + 12), true);
            }
          } catch (err) {
            console.warn('[P2P Engine] Piece selection warning:', err.message);
          }

          // Wait until head chunks of the file are on disk in fullFilePath
          const targetBytes = Math.min(fileToStream.length, 1024 * 1024);
          try {
            await waitForHeadChunks(fullFilePath, targetBytes, 30000, () => clientDisconnected);
          } catch (err) {
            if (!res.headersSent && !clientDisconnected) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: 'Buffering initial chunks',
                  message: err.message,
                })
              );
            }
            return;
          }

          if (clientDisconnected) return;

          const isHEVC = /x265|h265|hevc|h\.265|x\.265/i.test(fileToStream.name || '') ||
                         url.searchParams.get('hevc') === '1' ||
                         url.searchParams.get('transcode') === '1';

          res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'none',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache, no-store',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
          });

          if (req.method === 'HEAD') {
            res.end();
            return;
          }

          const ffmpegArgs = [
            '-loglevel', 'error',
            '-probesize', '1M',
            '-analyzeduration', '1M',
            '-fflags', '+nobuffer+fastseek',
            ...(startSeconds > 0 ? ['-ss', String(startSeconds)] : []),
            '-i', fullFilePath,
            ...(isHEVC
              ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency']
              : ['-c:v', 'copy']),
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            'pipe:1',
          ];

          const ffmpeg = spawn('ffmpeg', ffmpegArgs);

          let cleaned = false;
          const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            try { ffmpeg.stdout?.unpipe(res); } catch {}
            try { ffmpeg.stdout?.destroy(); } catch {}
            try { ffmpeg.stdin?.destroy(); } catch {}
            try { ffmpeg.stderr?.destroy(); } catch {}
            try {
              if (process.platform === 'win32') {
                ffmpeg.kill();
              } else {
                ffmpeg.kill('SIGKILL');
              }
            } catch {}
          };

          ffmpeg.stdout.on('error', cleanup);
          ffmpeg.on('error', (err) => {
            console.warn('[P2P Engine] FFmpeg process error:', err.message);
            cleanup();
          });
          ffmpeg.on('close', cleanup);
          req.on('close', cleanup);
          res.on('close', cleanup);
          res.on('finish', cleanup);

          ffmpeg.stdout.pipe(res);
          return;
        }

        // B. NATIVE MP4, WebM, and natively playable files with HTTP 206 Partial Content (Range requests)
        try {
          fileToStream.select();
        } catch {}

        const totalSize = fileToStream.length;
        const mimeType = getMimeType(fileToStream.name);
        const range = req.headers.range;

        if (range) {
          const rangeParts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(rangeParts[0], 10);
          const end = rangeParts[1] ? parseInt(rangeParts[1], 10) : totalSize - 1;

          if (isNaN(start) || start >= totalSize || end < start) {
            res.writeHead(416, {
              'Content-Range': `bytes */${totalSize}`,
              'Content-Type': 'text/plain',
              'Access-Control-Allow-Origin': '*',
            });
            res.end('Requested range not satisfiable');
            return;
          }

          const chunksize = end - start + 1;

          // Dynamically prioritize pieces for this range
          if (entry.engine && entry.engine.torrent) {
            const pieceLength = entry.engine.torrent.pieceLength || 4194304;
            const reqStartPiece = Math.floor((fileToStream.offset + start) / pieceLength);
            const reqEndPiece = Math.floor((fileToStream.offset + end) / pieceLength);
            const maxPiece = Math.floor(
              (fileToStream.offset + fileToStream.length - 1) / pieceLength
            );
            entry.engine.select(
              reqStartPiece,
              Math.min(maxPiece, Math.max(reqEndPiece, reqStartPiece + 4)),
              true
            );
          }

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
          });

          if (req.method === 'HEAD') {
            res.end();
            return;
          }

          const stream = fileToStream.createReadStream({ start, end });

          let streamCleaned = false;
          const cleanup = () => {
            if (streamCleaned) return;
            streamCleaned = true;
            try { stream.unpipe(res); } catch {}
            try { stream.destroy(); } catch {}
          };

          req.on('close', cleanup);
          res.on('close', cleanup);
          res.on('finish', cleanup);
          stream.on('error', (err) => {
            cleanup();
            console.warn('[P2P Engine] Stream read error:', err.message);
          });

          stream.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': totalSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
          });

          if (req.method === 'HEAD') {
            res.end();
            return;
          }

          const stream = fileToStream.createReadStream();

          let streamCleaned = false;
          const cleanup = () => {
            if (streamCleaned) return;
            streamCleaned = true;
            try { stream.unpipe(res); } catch {}
            try { stream.destroy(); } catch {}
          };

          req.on('close', cleanup);
          res.on('close', cleanup);
          res.on('finish', cleanup);
          stream.on('error', (err) => {
            cleanup();
            console.warn('[P2P Engine] Stream read error:', err.message);
          });

          stream.pipe(res);
        }
      })
      .catch((err) => {
        console.error('[P2P Engine] Stream handler error:', err);
        if (!res.headersSent && !clientDisconnected) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Swarm Connecting',
              message: err.message,
            })
          );
        }
      });

    return;
  }

  // Next middleware in chain
  if (next) {
    next();
  }
}
