const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const WebSocketManager = require('./src/backend/websocketServer.cjs');

async function start() {
  const { GameServer } = await import('./src/backend/GameServer.js');
  const { SERVER_CONFIG, MIME_TYPES } = await import('./src/shared/GameConstants.js');
  const port = Number(process.env.PORT ?? SERVER_CONFIG.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('PORT must be an integer between 0 and 65535');
  const game = new GameServer();
  const sockets = new WebSocketManager(game);
  game.setWebSocketManager(sockets);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Method not allowed');
    }
    try {
      const decoded = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (decoded.includes('\\')) throw new URIError('Invalid path');
      const pathname = path.posix.normalize(decoded);
      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }));
      }
      // Only browser assets are public; backend, metadata and dependencies stay private.
      const clientPath =
        /^\/(?:assets\/[^/]+\.(?:png|svg)|src\/(?:app|framework|shared|styles)\/[\w/.-]+\.(?:js|css))$/;
      const isPage =
        pathname === '/' ||
        (!path.extname(pathname) &&
          !pathname.startsWith('/api/') &&
          !pathname.startsWith('/src/') &&
          !pathname.startsWith('/.'));
      if (!isPage && !clientPath.test(pathname)) {
        res.writeHead(404);
        return res.end('Not found');
      }
      const relative = isPage ? 'index.html' : pathname.slice(1);
      const file = path.resolve(__dirname, relative);
      if (!file.startsWith(__dirname + path.sep)) {
        res.writeHead(404);
        return res.end('Not found');
      }
      const content = await fs.readFile(file);
      res.writeHead(isPage && pathname !== '/' ? 404 : 200, {
        'Content-Type': MIME_TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status = error instanceof URIError ? 400 : error.code === 'ENOENT' ? 404 : 500;
      if (status === 500) console.error('HTTP request failed:', error);
      res.writeHead(status);
      res.end(
        status === 400 ? 'Invalid URL' : status === 404 ? 'Not found' : 'Internal server error',
      );
    }
  });
  sockets.initWebSocketServer(server);
  server.listen(port, process.env.HOST || '0.0.0.0', () => {
    console.log(
      `Bomberman: Real-Time Multiplayer Web Game ? http://localhost:${server.address().port}`,
    );
  });
  server.on('error', (error) => {
    console.error('Server failed:', error.message);
    game.dispose();
    sockets.close();
    process.exitCode = 1;
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    game.dispose();
    sockets.close();
    server.close();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Unable to start Bomberman:', error.message);
  process.exitCode = 1;
});
