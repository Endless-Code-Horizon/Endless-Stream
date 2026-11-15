const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Enable hardware video acceleration and codecs for maximum performance
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

let mainWindow = null;
let streamingServer = null;

async function startEmbeddedServer() {
  try {
    const { p2pMiddleware } = await import('../server/p2pMiddleware.js');
    const distPath = path.join(__dirname, '../dist');

    streamingServer = http.createServer((req, res) => {
      // 1. Let p2pMiddleware handle /stream, /stats, /addon-proxy, /subtitles-proxy
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
          });
          return fs.createReadStream(filePath).pipe(res);
        }

        // SPA fallback to index.html for React Router
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
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
