const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Hardware video acceleration, decoding, and GPU flags for maximum playback performance
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');

let mainWindow = null;
let streamingServer = null;

async function startEmbeddedServer() {
  try {
    const { p2pMiddleware } = await import('../server/p2pMiddleware.js');
    const distPath = path.join(__dirname, '../dist');

    streamingServer = http.createServer((req, res) => {
      // Ensure CORS headers for all 127.0.0.1:5173 requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Authorization, Origin, X-Requested-With');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // 1. Let p2pMiddleware handle /stream, /stats, /addon-proxy, /subtitles-proxy, /p2p-health, /p2p-cache
      p2pMiddleware(req, res, () => {
        // 2. Serve static production assets from dist
        let reqPath = (req.url || '/').split('?')[0];
        if (reqPath === '/' || !reqPath) reqPath = '/index.html';
        const filePath = path.join(distPath, reqPath);

        // Security check
        if (!filePath.startsWith(distPath)) {
          res.writeHead(403);
          return res.end('Forbidden');
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff2': 'font/woff2',
            '.woff': 'font/woff',
          };
          res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          });
          return fs.createReadStream(filePath).pipe(res);
        }

        // SPA fallback to index.html for React Router
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          });
          return fs.createReadStream(indexPath).pipe(res);
        }

        res.writeHead(404);
        res.end('Not Found');
      });
    });

    await new Promise((resolve) => {
      streamingServer.listen(5173, '127.0.0.1', () => {
        console.log('[Endless Stream Desktop] Embedded server listening on http://127.0.0.1:5173');
        resolve();
      });
      streamingServer.on('error', (err) => {
        // If port 5173 is already running (e.g. Vite dev mode), continue smoothly
        console.log('[Endless Stream Desktop] Port note:', err.message);
        resolve();
      });
    });
  } catch (err) {
    console.warn('[Endless Stream Desktop] Server startup warning:', err.message);
  }
}

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, '../Assets/favicon.ico'))
    ? path.join(__dirname, '../Assets/favicon.ico')
    : path.join(__dirname, '../public/favicon.ico');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Endless Stream',
    backgroundColor: '#0a0a0c',
    icon: iconPath,
    frame: true, // Native Windows title bar with minimize/maximize/close
    titleBarStyle: 'default',
    autoHideMenuBar: true, // Clean Netflix/Apple TV+ experience
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows seamless P2P torrent streaming & cross-origin addons
      allowRunningInsecureContent: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Enable CORS headers on all session web requests (for 127.0.0.1:5173 and external addons)
  if (session && session.defaultSession) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = Object.assign({}, details.responseHeaders);
      responseHeaders['access-control-allow-origin'] = ['*'];
      responseHeaders['access-control-allow-methods'] = ['GET, HEAD, POST, PUT, DELETE, OPTIONS'];
      responseHeaders['access-control-allow-headers'] = ['*'];
      responseHeaders['access-control-expose-headers'] = ['Content-Range, Content-Length, Accept-Ranges'];
      callback({ responseHeaders });
    });
  }

  const appUrl = 'http://127.0.0.1:5173';

  mainWindow.loadURL(appUrl).catch(() => {
    // Retry once if server was still initializing
    setTimeout(() => {
      if (mainWindow) mainWindow.loadURL(appUrl).catch(() => {});
    }, 1200);
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startEmbeddedServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  try {
    streamingServer?.close();
  } catch {}
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
