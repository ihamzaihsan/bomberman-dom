import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { SharedArenaStore, createAction, sessionHash } from './SharedArenaStore.js';

export class SharedWebSocketServer {
  constructor(server, storeFactory = () => SharedArenaStore.fromEnv()) {
    this.storeFactory = storeFactory;
    this.connections = new Set();
    this.queue = Promise.resolve();
    this.pendingOperations = 0;
    this.wss = new WebSocketServer({ server, maxPayload: 4096 });
    this.wss.on('connection', (socket, request) => this.connect(socket, request));
  }

  connect(socket, request) {
    let sameOrigin = true;
    if (request.headers.origin) {
      try { sameOrigin = new URL(request.headers.origin).host === request.headers.host; }
      catch { sameOrigin = false; }
    }
    const ip = request.socket.remoteAddress;
    if (!sameOrigin || this.connections.size >= 100 ||
        [...this.connections].filter(client => client.ip === ip).length >= 12) {
      socket.close(1008, 'Connection not allowed');
      return;
    }
    Object.assign(socket, {
      ip, connectionId: randomUUID(), hash: null, playerId: null,
      cursor: null, version: null, alive: true, lastPing: Date.now(),
      windowStart: Date.now(), messageCount: 0,
    });
    this.connections.add(socket);
    socket.on('pong', () => { socket.alive = true; });
    socket.on('message', raw => {
      const now = Date.now();
      if (now - socket.windowStart >= 1000) {
        socket.windowStart = now;
        socket.messageCount = 0;
      }
      if (++socket.messageCount > 40) return socket.close(1008, 'Too many messages');
      let message;
      try {
        message = JSON.parse(raw.toString());
        if (!message || Array.isArray(message) || typeof message.type !== 'string') throw new Error();
      } catch {
        this.send(socket, { type: 'error', message: 'Invalid message format' });
        return;
      }
      if (message.type === 'ping') return this.send(socket, { type: 'pong', timestamp: now });
      this.enqueue(async () => {
        if (!this.connections.has(socket)) return;
        const store = this.getStore();
        const result = await store.update(createAction(message, socket.connectionId, socket.hash), this.presence());
        const reply = result.reply;
        if (reply?.sessionToken) {
          socket.hash = sessionHash(reply.sessionToken);
          socket.playerId = reply.playerId;
          socket.cursor = result.room.sequence;
        }
        if (reply) this.send(socket, reply);
        this.publish(result.room);
      }, socket);
    });
    const disconnect = () => {
      this.connections.delete(socket);
      if (!this.connections.size) clearTimeout(this.pollTimer);
    };
    socket.on('close', disconnect);
    socket.on('error', () => { disconnect(); socket.terminate(); });
    this.send(socket, { type: 'connected', resumeSupported: true });
    if (this.connections.size === 1) this.poll();
  }

  getStore() { return this.store ??= this.storeFactory(); }
  presence() {
    return [...this.connections].filter(socket => socket.hash)
      .map(({ hash, connectionId }) => ({ hash, connectionId }));
  }

  enqueue(work, socket) {
    if (this.pendingOperations >= 64 || (socket?.pendingOperations || 0) >= 8) {
      socket?.close(1008, 'Too many pending actions');
      return Promise.resolve();
    }
    this.pendingOperations++;
    if (socket) socket.pendingOperations = (socket.pendingOperations || 0) + 1;
    this.queue = this.queue.then(work).catch(error => {
      // Never log storage commands or credentials from SDK error messages.
      console.error('Shared arena operation failed:', error.name);
      if (socket) this.send(socket, { type: 'error', message: 'Game server unavailable. Please retry.' });
      else for (const client of this.connections) client.close(1013, 'Game server temporarily unavailable');
    }).finally(() => {
      this.pendingOperations--;
      if (socket) socket.pendingOperations--;
    });
    return this.queue;
  }

  async poll() {
    await this.enqueue(async () => {
      if (!this.connections.size) return;
      const now = Date.now();
      for (const socket of this.connections) {
        if (now - socket.lastPing >= 10000) {
          if (!socket.alive) { socket.terminate(); continue; }
          socket.alive = false;
          socket.lastPing = now;
          socket.ping();
        }
      }
      // Before joining, the lobby doesn't need to read Redis every frame.
      if (!this.presence().length) return;
      const { room } = await this.getStore().update(null, this.presence());
      this.publish(room);
    });
    if (this.connections.size) this.pollTimer = setTimeout(() => this.poll(), 150);
  }

  publish(room) {
    for (const socket of this.connections) {
      if (!socket.playerId) continue;
      if (room.sessions[socket.hash] && room.sessions[socket.hash].connectionId !== socket.connectionId) {
        socket.close(4001, 'Session resumed on another connection');
        continue;
      }
      for (const event of room.events) {
        if (event.sequence > socket.cursor) this.send(socket, event.message);
      }
      socket.cursor = room.sequence;
      if (socket.version !== room.version) {
        this.send(socket, { type: 'game_state_update', gameState: room.engine.gameState });
        socket.version = room.version;
      }
      if (!room.sessions[socket.hash]) {
        socket.hash = null;
        socket.playerId = null;
        this.send(socket, { type: 'resume_error', message: 'Your previous session has ended' });
      }
    }
  }

  send(socket, message) {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 1024 * 1024) { socket.terminate(); return; }
    socket.send(JSON.stringify(message), error => { if (error) socket.terminate(); });
  }

  close() {
    clearTimeout(this.pollTimer);
    for (const socket of this.connections) socket.terminate();
    this.connections.clear();
    this.wss.close();
  }
}
