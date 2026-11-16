import http from 'http';
import { p2pMiddleware, getOrCreateEngine, pruneCacheIfNeeded } from './p2pMiddleware.js';

const PORT = process.env.PORT || 4000;

const server = http.createServer((req, res) => {
  p2pMiddleware(req, res, () => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ [Endless Stream] Native BitTorrent P2P Engine running on http://127.0.0.1:${PORT}`);
});

export { p2pMiddleware, getOrCreateEngine, pruneCacheIfNeeded };
export default server;
