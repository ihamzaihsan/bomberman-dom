const WebSocket = require('ws');

class WebSocketManager {
  constructor(gameServer) {
    this.gameServer = gameServer;
    this.clients = new Map();
    this.wss = null;

    // Connection tracking to prevent duplicate connections
    this.connectionAttempts = new Map();
    this.pendingJoins = new Map();
    this.joinRateLimit = 500;
    this.ipRateLimit = 2000;
    this.maxConnectionsPerIP = 5;

    console.log('WebSocketManager initialized with connection deduplication');
  }

  initWebSocketServer(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      const clientIP = req.socket.remoteAddress || req.connection.remoteAddress || 'unknown';
      console.log(`New WebSocket connection established from ${clientIP}`);

      if (!this.validateConnectionLimit(clientIP)) {
        console.log(`Connection rejected: Too many connections from ${clientIP}`);
        ws.close(1008, 'Too many connections from this IP address');
        return;
      }

      ws.clientIP = clientIP;

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('WebSocket message received:', data.type);
          console.log('Current client count:', this.clients.size);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.sendToClient(ws, { type: 'error', message: 'Invalid message format' });
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.handleClientDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleClientDisconnect(ws);
      });

      this.sendToClient(ws, {
        type: 'connected',
        message: 'WebSocket connection established'
      });
    });

    console.log('WebSocket server initialized');

    // Start periodic cleanup of stale pending joins
    setInterval(() => {
      this.cleanupPendingJoins();
    }, 30000);
  }

  handleWebSocketMessage(ws, data) {
    console.log('Processing WebSocket message:', data.type);

    switch (data.type) {
      case 'join':
        console.log('Routing to handlePlayerJoin...');
        this.handlePlayerJoin(ws, data);
        break;
      case 'move':
        this.handlePlayerMove(ws, data);
        break;
      case 'bomb':
        this.handleBombPlace(ws, data);
        break;
      case 'chat':
        this.handleChatMessage(ws, data);
        break;
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;
      default:
        console.warn('Unknown message type:', data.type);
        this.sendToClient(ws, { type: 'error', message: 'Unknown message type' });
    }
  }

  handlePlayerJoin(ws, data) {
    console.log('Handling player join via WebSocket');
    console.log('Join data received:', data);

    const { nickname } = data;
    console.log('Extracted nickname:', nickname);

    if (!nickname || nickname.length < 2 || nickname.length > 20) {
      console.log('Rejecting join: Invalid nickname length');
      this.sendToClient(ws, {
        type: 'join_error',
        message: 'Nickname must be between 2 and 20 characters'
      });
      return;
    }

    const normalizedNickname = nickname.trim().toLowerCase();
    const now = Date.now();

    // Check if there's already a pending join for this nickname
    if (this.pendingJoins.has(normalizedNickname)) {
      const pending = this.pendingJoins.get(normalizedNickname);
      if (now - pending.timestamp < this.joinRateLimit) {
        console.log(`Rejecting join: Rapid join attempt for "${nickname}" (${now - pending.timestamp}ms ago)`);
        this.sendToClient(ws, {
          type: 'join_error',
          message: 'Please wait before attempting to join again'
        });
        return;
      }
    }

    if (!this.validateJoinRateLimit(ws.clientIP)) {
      console.log(`Rejecting join: Rate limit exceeded for IP ${ws.clientIP}`);
      this.sendToClient(ws, {
        type: 'join_error',
        message: 'Too many join attempts. Please wait and try again.'
      });
      return;
    }

    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    console.log('Generated player ID:', playerId);

    // Mark this nickname as pending to prevent race conditions
    this.pendingJoins.set(normalizedNickname, { timestamp: now, playerId: playerId });
    console.log(`Marked "${nickname}" as pending join (Player ID: ${playerId})`);

    console.log('Calling gameServer.addPlayer...');
    const result = this.gameServer.addPlayer(playerId, nickname);
    console.log('addPlayer result:', result);

    if (result.success) {
      console.log('Join successful, processing...');

      this.pendingJoins.delete(normalizedNickname);
      console.log(`Cleared pending join for "${nickname}"`);

      this.clients.set(playerId, ws);
      ws.playerId = playerId;
      ws.playerNickname = nickname;
      console.log(`Stored WebSocket connection for player: ${playerId} (${nickname})`);
      console.log(`Total active connections: ${this.clients.size}`);

      const joinSuccessMessage = {
        type: 'join_success',
        playerId: playerId,
        player: result.player,
        gameState: this.gameServer.getCleanGameState()
      };

      console.log(`Sending join_success to player: ${playerId} (${nickname})`);
      console.log('Join success message:', joinSuccessMessage);
      this.sendToClient(ws, joinSuccessMessage);
      console.log(`join_success message sent successfully to ${nickname}`);

      // Store the current join context to prevent stale closures
      const joinContext = {
        playerId: playerId,
        nickname: nickname,
        ws: ws,
        timestamp: Date.now()
      };

      setTimeout(() => {
        // Verify this player still exists before broadcasting
        const currentPlayers = this.gameServer.getGameState().players;
        if (!currentPlayers[joinContext.playerId]) {
          console.log(`Skipping broadcast for ${joinContext.nickname} - player no longer exists`);
          return;
        }

        // Verify WebSocket is still connected
        if (joinContext.ws.readyState !== joinContext.ws.OPEN) {
          console.log(`Skipping broadcast for ${joinContext.nickname} - WebSocket closed`);
          return;
        }

        console.log(`Broadcasting player_joined event for ${joinContext.nickname} to other players...`);
        this.broadcastEventExcept(joinContext.ws, 'player_joined', {
          playerId: joinContext.playerId,
          nickname: joinContext.nickname,
          playerCount: Object.keys(currentPlayers).length
        });

        setTimeout(() => {
          // Verify player still exists before final broadcast
          const latestPlayers = this.gameServer.getGameState().players;
          if (!latestPlayers[joinContext.playerId]) {
            console.log(`Skipping game state broadcast for ${joinContext.nickname} - player no longer exists`);
            return;
          }

          console.log(`Broadcasting game state update for ${joinContext.nickname}...`);
          this.broadcastGameState();
        }, 50);
      }, 100);

      console.log(`Player ${nickname} joined via WebSocket with ID: ${playerId}`);
    } else {
      console.log(`Join failed for "${nickname}":`, result.error);

      this.pendingJoins.delete(normalizedNickname);
      console.log(`Cleared pending join for "${nickname}" due to failure`);

      const errorMessage = {
        type: 'join_error',
        message: result.error
      };

      console.log(`Sending join_error to "${nickname}":`, errorMessage);
      this.sendToClient(ws, errorMessage);
      console.log(`join_error message sent to ${nickname}`);
    }
  }

  handlePlayerMove(ws, data) {
    const { direction } = data;
    const playerId = ws.playerId;

    if (!playerId) {
      this.sendToClient(ws, { type: 'error', message: 'Player not authenticated' });
      return;
    }

    const canMove = this.gameServer.validatePlayerMove(playerId, direction);

    if (!canMove) {
      this.sendToClient(ws, {
        type: 'move_result',
        success: false,
        direction: direction,
        reason: 'Invalid move'
      });
      return;
    }
    
    const success = this.gameServer.movePlayer(playerId, direction);

    if (success) {
      this.broadcastGameState();
    }

    this.sendToClient(ws, {
      type: 'move_result',
      success: success,
      direction: direction
    });
  }

  handleBombPlace(ws, data) {
    const playerId = ws.playerId;

    if (!playerId) {
      this.sendToClient(ws, { type: 'error', message: 'Player not authenticated' });
      return;
    }

    console.log(`Bomb placement request from ${playerId}`);

    const playerBefore = this.gameServer.gameState.players[playerId];
    const beforeState = playerBefore ? {
      maxBombs: playerBefore.maxBombs,
      currentBombs: playerBefore.currentBombs
    } : null;

    const success = this.gameServer.placeBomb(playerId);

    const playerAfter = this.gameServer.gameState.players[playerId];
    const afterState = playerAfter ? {
      maxBombs: playerAfter.maxBombs,
      currentBombs: playerAfter.currentBombs
    } : null;

    console.log(`Bomb placement result: ${success}`);
    console.log(`Player state: Before: ${beforeState ? `${beforeState.currentBombs}/${beforeState.maxBombs}` : 'null'}, After: ${afterState ? `${afterState.currentBombs}/${afterState.maxBombs}` : 'null'}`);

    this.broadcastGameState();

    this.sendToClient(ws, {
      type: 'bomb_result',
      success: success,
      playerBombState: afterState,
      debug: {
        before: beforeState,
        after: afterState,
        timestamp: Date.now()
      }
    });
  }

  handleChatMessage(ws, data) {
    const { message } = data;
    const playerId = ws.playerId;

    if (!playerId) {
      this.sendToClient(ws, { type: 'error', message: 'Player not authenticated' });
      return;
    }

    const gameState = this.gameServer.getGameState();
    const player = gameState.players[playerId];
    if (!player) {
      this.sendToClient(ws, { type: 'error', message: 'Player not found' });
      return;
    }

    this.broadcastToAll({
      type: 'chat_message',
      playerId: playerId,
      nickname: player.nickname,
      message: message,
      timestamp: Date.now()
    });

    console.log(`Chat message from ${player.nickname}: ${message}`);
  }

  handleClientDisconnect(ws) {
    const playerId = ws.playerId;
    if (playerId) {
      console.log(`Player ${playerId} disconnected`);

      const gameState = this.gameServer.getGameState();
      if (gameState.players[playerId]) {
        const playerNickname = gameState.players[playerId].nickname;

        if (playerNickname) {
          const normalizedNickname = playerNickname.trim().toLowerCase();
          if (this.pendingJoins.has(normalizedNickname)) {
            this.pendingJoins.delete(normalizedNickname);
            console.log(`Cleaned up pending join for disconnected player "${playerNickname}"`);
          }
        }

        this.gameServer.removePlayer(playerId);
        console.log(`Removed player ${playerId} from game`);

        this.broadcastEvent('player_left', {
          playerId: playerId,
          nickname: playerNickname,
          playerCount: Object.keys(this.gameServer.getGameState().players).length
        });

        this.broadcastGameState();

        const remainingPlayers = Object.keys(gameState.players).length;
        if (remainingPlayers < 1 && gameState.gameStarted) {
          this.gameServer.endGame('All players disconnected');
        }
      }

      this.clients.delete(playerId);
    }
  }

  sendToClient(ws, message) {
    console.log('Sending message to client:', message.type);

    if (ws.readyState === WebSocket.OPEN) {
      try {
        const messageString = JSON.stringify(message);
        ws.send(messageString);
        console.log('Message sent successfully');
      } catch (error) {
        console.error('Error sending message to client:', error);
      }
    } else {
      console.log('WebSocket not open, cannot send message');
    }
  }

  broadcastToAll(message) {
    this.clients.forEach((ws) => {
      this.sendToClient(ws, message);
    });
  }

  broadcastGameState() {
    const message = {
      type: 'game_state_update',
      gameState: this.gameServer.getCleanGameState(),
      timestamp: Date.now()
    };

    this.broadcastToAll(message);
    console.log('Game state broadcasted to all clients');
  }

  broadcastEvent(eventType, eventData) {
    const message = {
      type: 'game_event',
      eventType: eventType,
      data: eventData,
      timestamp: Date.now()
    };

    this.broadcastToAll(message);
    console.log(`Event '${eventType}' broadcasted to all clients`);
  }

  broadcastEventExcept(excludeWs, eventType, eventData) {
    const message = {
      type: 'game_event',
      eventType: eventType,
      data: eventData,
      timestamp: Date.now()
    };

    this.clients.forEach((ws) => {
      if (ws !== excludeWs) {
        this.sendToClient(ws, message);
      }
    });
    console.log(`Event '${eventType}' broadcasted to all clients except one`);
  }

  getConnectedClientsCount() {
    return this.clients.size;
  }

  getConnectedPlayerIds() {
    return Array.from(this.clients.keys());
  }

  validateConnectionLimit(clientIP) {
    if (clientIP === 'unknown') return true;

    let connectionsFromIP = 0;
    this.clients.forEach((ws) => {
      if (ws.clientIP === clientIP) {
        connectionsFromIP++;
      }
    });

    console.log(`IP ${clientIP} has ${connectionsFromIP} active connections (max: ${this.maxConnectionsPerIP})`);
    return connectionsFromIP < this.maxConnectionsPerIP;
  }

  validateJoinRateLimit(clientIP) {
    if (clientIP === 'unknown') return true;

    const now = Date.now();
    const connectionData = this.connectionAttempts.get(clientIP);

    if (!connectionData) {
      this.connectionAttempts.set(clientIP, { count: 1, lastAttempt: now, firstAttempt: now });
      console.log(`First join attempt from IP ${clientIP} - allowed`);
      return true;
    }

    const timeSinceLastAttempt = now - connectionData.lastAttempt;
    const timeSinceFirstAttempt = now - connectionData.firstAttempt;

    if (timeSinceLastAttempt >= this.ipRateLimit) {
      if (timeSinceFirstAttempt > 30000) {
        this.connectionAttempts.set(clientIP, { count: 1, lastAttempt: now, firstAttempt: now });
        console.log(`IP ${clientIP} rate limit reset after ${timeSinceFirstAttempt}ms - allowed`);
      } else {
        connectionData.count++;
        connectionData.lastAttempt = now;
        console.log(`IP ${clientIP} join allowed (${timeSinceLastAttempt}ms since last, attempt #${connectionData.count})`);
      }
      return true;
    }

    if (connectionData.count >= 3 && timeSinceFirstAttempt < 10000) {
      console.log(`Rate limit: IP ${clientIP} made ${connectionData.count} attempts in ${timeSinceFirstAttempt}ms (blocked)`);
      return false;
    }

    connectionData.count++;
    connectionData.lastAttempt = now;
    console.log(`IP ${clientIP} quick join attempt #${connectionData.count} (${timeSinceLastAttempt}ms ago) - allowed with warning`);
    return true;
  }

  cleanupPendingJoins() {
    const now = Date.now();
    const pendingTimeout = 30000;
    const connectionTimeout = 300000;

    for (const [nickname, data] of this.pendingJoins.entries()) {
      if (now - data.timestamp > pendingTimeout) {
        console.log(`Cleaning up stale pending join for "${nickname}"`);
        this.pendingJoins.delete(nickname);
      }
    }

    for (const [ip, data] of this.connectionAttempts.entries()) {
      if (now - data.firstAttempt > connectionTimeout) {
        console.log(`Cleaning up old connection data for IP ${ip}`);
        this.connectionAttempts.delete(ip);
      }
    }
  }
}

module.exports = WebSocketManager;
