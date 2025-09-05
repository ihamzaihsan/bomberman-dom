const { randomUUID } = require('node:crypto');
const WebSocket = require('ws');

class WebSocketManager {
  constructor(gameServer) {
    this.gameServer = gameServer;
    this.connections = new Set();
  }

  initWebSocketServer(server) {
    this.wss = new WebSocket.Server({ server, maxPayload: 4096 });
    this.wss.on('connection', (ws, req) => {
      let sameOrigin = true;
      if (req.headers.origin) {
        try {
          sameOrigin = new URL(req.headers.origin).host === req.headers.host;
        } catch {
          sameOrigin = false;
        }
      }
      const ip = req.socket.remoteAddress;
      const count = [...this.connections].filter((client) => client.ip === ip).length;
      if (!sameOrigin || count >= 12 || this.connections.size >= 100) {
        ws.close(1008, 'Connection not allowed');
        return;
      }
      ws.ip = ip;
      ws.alive = true;
      ws.windowStart = Date.now();
      ws.messageCount = 0;
      ws.lastChat = 0;
      this.connections.add(ws);
      ws.on('pong', () => {
        ws.alive = true;
      });
      ws.on('message', (message) => {
        const now = Date.now();
        if (now - ws.windowStart >= 1000) {
          ws.windowStart = now;
          ws.messageCount = 0;
        }
        if (++ws.messageCount > 40) return ws.close(1008, 'Too many messages');
        try {
          const data = JSON.parse(message.toString());
          if (
            !data ||
            typeof data !== 'object' ||
            Array.isArray(data) ||
            typeof data.type !== 'string'
          )
            throw new Error('Invalid message');
          this.handleWebSocketMessage(ws, data);
        } catch {
          this.sendToClient(ws, { type: 'error', message: 'Invalid message format' });
        }
      });
      ws.on('close', () => this.handleClientDisconnect(ws));
      ws.on('error', () => {
        this.handleClientDisconnect(ws);
        ws.terminate();
      });
      this.sendToClient(ws, { type: 'connected', message: 'WebSocket connection established' });
    });
    this.heartbeat = setInterval(() => {
      for (const ws of this.connections) {
        if (!ws.alive) {
          ws.terminate();
          continue;
        }
        ws.alive = false;
        ws.ping();
      }
    }, 30000);
    this.heartbeat.unref();
  }

  handleWebSocketMessage(ws, data) {
    if (data.type === 'ping') return this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
    if (data.type === 'join') {
      if (ws.playerId)
        return this.sendToClient(ws, { type: 'join_error', message: 'You have already joined' });
      const playerId = randomUUID();
      const result = this.gameServer.addPlayer(playerId, data.nickname);
      if (!result.success)
        return this.sendToClient(ws, { type: 'join_error', message: result.error });
      ws.playerId = playerId;
      this.sendToClient(ws, {
        type: 'join_success',
        playerId,
        player: result.player,
        gameState: this.gameServer.getCleanGameState(),
      });
      this.broadcastToAll(
        {
          type: 'game_event',
          eventType: 'player_joined',
          data: {
            playerId,
            nickname: result.player.nickname,
            playerCount: Object.keys(this.gameServer.gameState.players).length,
          },
        },
        ws,
      );
      return this.broadcastGameState();
    }
    const player = this.gameServer.gameState.players[ws.playerId];
    if (!player) return this.sendToClient(ws, { type: 'error', message: 'Join the lobby first' });
    switch (data.type) {
      case 'move': {
        if (!['up', 'down', 'left', 'right'].includes(data.direction))
          return this.sendToClient(ws, { type: 'error', message: 'Invalid direction' });
        const success = this.gameServer.movePlayer(ws.playerId, data.direction);
        if (success) this.broadcastGameState();
        this.sendToClient(ws, { type: 'move_result', success, direction: data.direction });
        break;
      }
      case 'bomb': {
        const success = this.gameServer.placeBomb(ws.playerId);
        if (success) this.broadcastGameState();
        this.sendToClient(ws, {
          type: 'bomb_result',
          success,
          playerBombState: { maxBombs: player.maxBombs, currentBombs: player.currentBombs },
        });
        break;
      }
      case 'chat': {
        if (
          typeof data.message !== 'string' ||
          !data.message.trim() ||
          data.message.trim().length > 100 ||
          /[\u0000-\u001f\u007f]/u.test(data.message)
        )
          return this.sendToClient(ws, {
            type: 'error',
            message: 'Chat messages must contain 1 to 100 characters',
          });
        if (Date.now() - ws.lastChat < 500)
          return this.sendToClient(ws, {
            type: 'error',
            message: 'Please wait before sending another message',
          });
        ws.lastChat = Date.now();
        this.broadcastToAll({
          type: 'chat_message',
          playerId: player.id,
          nickname: player.nickname,
          message: data.message.trim(),
          timestamp: Date.now(),
        });
        break;
      }
      default:
        this.sendToClient(ws, { type: 'error', message: 'Unknown message type' });
    }
  }

  handleClientDisconnect(ws) {
    if (!this.connections.delete(ws)) return;
    const player = this.gameServer.gameState.players[ws.playerId];
    if (!player) return;
    this.gameServer.removePlayer(ws.playerId);
    this.broadcastEvent('player_left', {
      playerId: player.id,
      nickname: player.nickname,
      playerCount: Object.keys(this.gameServer.gameState.players).length,
    });
    this.broadcastGameState();
  }

  sendToClient(ws, message) {
    if (ws.readyState !== WebSocket.OPEN) return;
    // Drop slow consumers rather than accumulating an unbounded send queue.
    if (ws.bufferedAmount > 1024 * 1024) return ws.terminate();
    ws.send(JSON.stringify(message), (error) => {
      if (error) ws.terminate();
    });
  }

  broadcastToAll(message, excluded = null) {
    for (const ws of this.connections)
      if (ws !== excluded && ws.playerId) this.sendToClient(ws, message);
  }
  broadcastGameState() {
    this.broadcastToAll({
      type: 'game_state_update',
      gameState: this.gameServer.getCleanGameState(),
      timestamp: Date.now(),
    });
  }
  broadcastEvent(eventType, data) {
    const message = { type: 'game_event', eventType, data, timestamp: Date.now() };
    if (eventType === 'game_reset') {
      for (const ws of this.connections) this.sendToClient(ws, message);
    } else this.broadcastToAll(message);
  }
  clearPlayerSessions() {
    for (const ws of this.connections) delete ws.playerId;
  }
  close() {
    clearInterval(this.heartbeat);
    const connections = [...this.connections];
    this.connections.clear();
    for (const ws of connections) ws.terminate();
    this.wss?.close();
  }
}

module.exports = WebSocketManager;
