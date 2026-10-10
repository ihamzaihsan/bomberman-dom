import { createServer } from 'node:http';
import { SharedWebSocketServer } from '../src/backend/SharedWebSocketServer.js';

// Vercel upgrades connections on this exported server; it owns the listening port.
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  try {
    await sockets.getStore().redis.ping();
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }));
  } catch (error) {
    console.error('Game health check failed:', error.name);
    response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'unavailable' }));
  }
});
const sockets = new SharedWebSocketServer(server);
export default server;
