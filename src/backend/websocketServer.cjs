const WebSocket = require('ws');

class WebSocketManager {
  constructor(gameServer) {
    this.gameServer = gameServer;
    this.clients = new Map(); // Map of playerId -> WebSocket connection
    this.wss = null; // WebSocket server instance

    // ✅ ROOT CAUSE FIX: Add connection tracking to prevent duplicate connections
    this.connectionAttempts = new Map(); // Map of IP -> { count, lastAttempt }
    this.pendingJoins = new Map(); // Map of nickname -> { timestamp, playerId }
    this.joinRateLimit = 500; // Minimum time between join attempts for same nickname (ms)
    this.ipRateLimit = 2000; // Minimum time between rapid join attempts from same IP (ms) - more lenient
    this.maxConnectionsPerIP = 5; // Maximum connections per IP address - increased for development

    console.log('WebSocketManager initialized with connection deduplication');
  }

  // Initialize WebSocket server
  initWebSocketServer(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      // ✅ ROOT CAUSE FIX: Extract client IP for connection tracking
      const clientIP = req.socket.remoteAddress || req.connection.remoteAddress || 'unknown';
      console.log(`New WebSocket connection established from ${clientIP}`);

      // ✅ ROOT CAUSE FIX: Check connection limits per IP
      if (!this.validateConnectionLimit(clientIP)) {
        console.log(`🚨 Connection rejected: Too many connections from ${clientIP}`);
        ws.close(1008, 'Too many connections from this IP address');
        return;
      }

      // Store client IP on WebSocket for tracking
      ws.clientIP = clientIP;

      // Handle incoming messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('=== WEBSOCKET MESSAGE RECEIVED ===');
          console.log('Message type:', data.type);
          console.log('Full message:', data);
          console.log('Current client count:', this.clients.size);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.sendToClient(ws, { type: 'error', message: 'Invalid message format' });
        }
      });
      
      // Handle connection close
      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.handleClientDisconnect(ws);
      });
      
      // Handle connection errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleClientDisconnect(ws);
      });
      
      // Send initial connection acknowledgment
      this.sendToClient(ws, { 
        type: 'connected', 
        message: 'WebSocket connection established' 
      });
    });
    
    console.log('WebSocket server initialized');

    // ✅ ROOT CAUSE FIX: Start periodic cleanup of stale pending joins
    setInterval(() => {
      this.cleanupPendingJoins();
    }, 30000); // Clean up every 30 seconds
  }

  // Handle WebSocket messages from clients
  handleWebSocketMessage(ws, data) {
    console.log('=== PROCESSING WEBSOCKET MESSAGE ===');
    console.log('Message type:', data.type);
    console.log('Message data:', data);

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

  // Handle player join via WebSocket
  handlePlayerJoin(ws, data) {
    console.log('=== HANDLING PLAYER JOIN VIA WEBSOCKET ===');
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

    // ✅ ROOT CAUSE FIX: Check for rapid join attempts and pending joins
    const normalizedNickname = nickname.trim().toLowerCase();
    const now = Date.now();

    // Check if there's already a pending join for this nickname
    if (this.pendingJoins.has(normalizedNickname)) {
      const pending = this.pendingJoins.get(normalizedNickname);
      if (now - pending.timestamp < this.joinRateLimit) {
        console.log(`🚨 Rejecting join: Rapid join attempt for "${nickname}" (${now - pending.timestamp}ms ago)`);
        this.sendToClient(ws, {
          type: 'join_error',
          message: 'Please wait before attempting to join again'
        });
        return;
      }
    }

    // Check connection rate limiting per IP
    if (!this.validateJoinRateLimit(ws.clientIP)) {
      console.log(`🚨 Rejecting join: Rate limit exceeded for IP ${ws.clientIP}`);
      this.sendToClient(ws, {
        type: 'join_error',
        message: 'Too many join attempts. Please wait and try again.'
      });
      return;
    }

    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    console.log('Generated player ID:', playerId);

    // ✅ ROOT CAUSE FIX: Mark this nickname as pending to prevent race conditions
    this.pendingJoins.set(normalizedNickname, { timestamp: now, playerId: playerId });
    console.log(`🔒 Marked "${nickname}" as pending join (Player ID: ${playerId})`);

    console.log('Calling gameServer.addPlayer...');
    const result = this.gameServer.addPlayer(playerId, nickname);
    console.log('addPlayer result:', result);

    if (result.success) {
      console.log('Join successful, processing...');

      // ✅ ROOT CAUSE FIX: Clear pending join on success
      this.pendingJoins.delete(normalizedNickname);
      console.log(`✅ Cleared pending join for "${nickname}"`);

      // Store the WebSocket connection for this player
      this.clients.set(playerId, ws);
      ws.playerId = playerId; // Store playerId on the WebSocket for easy access
      ws.playerNickname = nickname; // Store nickname for debugging
      console.log(`✅ Stored WebSocket connection for player: ${playerId} (${nickname})`);
      console.log(`📊 Total active connections: ${this.clients.size}`);

      // Send success response to the joining player
      const joinSuccessMessage = {
        type: 'join_success',
        playerId: playerId,
        player: result.player,
        gameState: this.gameServer.getCleanGameState()
      };

      console.log(`🎉 Sending join_success to player: ${playerId} (${nickname})`);
      console.log('Join success message:', joinSuccessMessage);
      this.sendToClient(ws, joinSuccessMessage);
      console.log(`✅ join_success message sent successfully to ${nickname}`);

      // ✅ CRITICAL FIX: Prevent race conditions by ensuring broadcasts only happen for successful joins
      // Store the current join context to prevent stale closures
      const joinContext = {
        playerId: playerId,
        nickname: nickname,
        ws: ws,
        timestamp: Date.now()
      };

      setTimeout(() => {
        // ✅ SAFETY CHECK: Verify this player still exists before broadcasting
        const currentPlayers = this.gameServer.getGameState().players;
        if (!currentPlayers[joinContext.playerId]) {
          console.log(`⚠️ Skipping broadcast for ${joinContext.nickname} - player no longer exists`);
          return;
        }

        // ✅ SAFETY CHECK: Verify WebSocket is still connected
        if (joinContext.ws.readyState !== joinContext.ws.OPEN) {
          console.log(`⚠️ Skipping broadcast for ${joinContext.nickname} - WebSocket closed`);
          return;
        }

        // Broadcast player join event to OTHER players (not the joining player)
        console.log(`Broadcasting player_joined event for ${joinContext.nickname} to other players...`);
        this.broadcastEventExcept(joinContext.ws, 'player_joined', {
          playerId: joinContext.playerId,
          nickname: joinContext.nickname,
          playerCount: Object.keys(currentPlayers).length
        });

        // Broadcast updated game state to all players after a small delay
        setTimeout(() => {
          // ✅ DOUBLE SAFETY CHECK: Verify player still exists before final broadcast
          const latestPlayers = this.gameServer.getGameState().players;
          if (!latestPlayers[joinContext.playerId]) {
            console.log(`⚠️ Skipping game state broadcast for ${joinContext.nickname} - player no longer exists`);
            return;
          }

          console.log(`Broadcasting game state update for ${joinContext.nickname}...`);
          this.broadcastGameState();
        }, 50); // Small delay to ensure proper message sequencing
      }, 100); // Allow join_success to be processed first

      console.log(`Player ${nickname} joined via WebSocket with ID: ${playerId}`);
    } else {
      console.log(`❌ Join failed for "${nickname}":`, result.error);

      // ✅ ROOT CAUSE FIX: Clear pending join on failure
      this.pendingJoins.delete(normalizedNickname);
      console.log(`🧹 Cleared pending join for "${nickname}" due to failure`);

      const errorMessage = {
        type: 'join_error',
        message: result.error
      };

      console.log(`🚨 Sending join_error to "${nickname}":`, errorMessage);
      this.sendToClient(ws, errorMessage);
      console.log(`❌ join_error message sent to ${nickname}`);
    }
  }

  // Handle player movement via WebSocket
  handlePlayerMove(ws, data) {
    const { direction } = data;
    const playerId = ws.playerId;
    
    if (!playerId) {
      this.sendToClient(ws, { type: 'error', message: 'Player not authenticated' });
      return;
    }
    
    // ✅ PERFORMANCE: Pre-validate move to avoid unnecessary processing
    const canMove = this.gameServer.validatePlayerMove(playerId, direction);
    
    if (!canMove) {
      // ✅ OPTIMIZATION: Early rejection - no server processing or broadcasting needed
      this.sendToClient(ws, {
        type: 'move_result',
        success: false,
        direction: direction,
        reason: 'Invalid move'
      });
      return;
    }
    
    // Only call movePlayer if the move is valid
    const success = this.gameServer.movePlayer(playerId, direction);
    
    if (success) {
      // ✅ PERFORMANCE: Only broadcast when position actually changes
      this.broadcastGameState();
    }
    
    // Send move result to the requesting player
    this.sendToClient(ws, {
      type: 'move_result',
      success: success,
      direction: direction
    });
  }

  // Handle bomb placement via WebSocket
  handleBombPlace(ws, data) {
    const playerId = ws.playerId;

    if (!playerId) {
      this.sendToClient(ws, { type: 'error', message: 'Player not authenticated' });
      return;
    }

    console.log(`🧪 BOMB PLACEMENT REQUEST from ${playerId}`);

    // ✅ CRITICAL FIX: Get player state before and after bomb placement
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

    console.log(`🧪 BOMB PLACEMENT RESULT: ${success}`);
    console.log(`🧪 PLAYER STATE: Before: ${beforeState ? `${beforeState.currentBombs}/${beforeState.maxBombs}` : 'null'}, After: ${afterState ? `${afterState.currentBombs}/${afterState.maxBombs}` : 'null'}`);

    // ✅ CRITICAL FIX: Immediately broadcast game state after bomb placement
    // This ensures all clients get the updated currentBombs count immediately
    this.broadcastGameState();

    // Send bomb placement result to the requesting player with detailed state info
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

  // Handle chat messages via WebSocket
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
    
    // Broadcast chat message to all players
    this.broadcastToAll({
      type: 'chat_message',
      playerId: playerId,
      nickname: player.nickname,
      message: message,
      timestamp: Date.now()
    });
    
    console.log(`Chat message from ${player.nickname}: ${message}`);
  }

  // Handle client disconnection
  handleClientDisconnect(ws) {
    const playerId = ws.playerId;
    if (playerId) {
      console.log(`Player ${playerId} disconnected`);

      // Remove player from game
      const gameState = this.gameServer.getGameState();
      if (gameState.players[playerId]) {
        const playerNickname = gameState.players[playerId].nickname;

        // ✅ ROOT CAUSE FIX: Clean up any pending joins for this player
        if (playerNickname) {
          const normalizedNickname = playerNickname.trim().toLowerCase();
          if (this.pendingJoins.has(normalizedNickname)) {
            this.pendingJoins.delete(normalizedNickname);
            console.log(`🧹 Cleaned up pending join for disconnected player "${playerNickname}"`);
          }
        }

        this.gameServer.removePlayer(playerId);
        console.log(`Removed player ${playerId} from game`);

        // Broadcast player left event
        this.broadcastEvent('player_left', {
          playerId: playerId,
          nickname: playerNickname,
          playerCount: Object.keys(this.gameServer.getGameState().players).length
        });

        // Broadcast updated game state
        this.broadcastGameState();
        
        // Check if game should end due to insufficient players
        const remainingPlayers = Object.keys(gameState.players).length;
        if (remainingPlayers < 1 && gameState.gameStarted) {
          this.gameServer.endGame('All players disconnected');
        }
      }
      
      // Remove WebSocket connection
      this.clients.delete(playerId);
    }
  }

  // Send message to a specific client
  sendToClient(ws, message) {
    console.log('=== SENDING MESSAGE TO CLIENT ===');
    console.log('WebSocket ready state:', ws.readyState);
    console.log('WebSocket.OPEN constant:', WebSocket.OPEN);
    console.log('Message type:', message.type);
    console.log('Full message:', message);

    if (ws.readyState === WebSocket.OPEN) {
      try {
        const messageString = JSON.stringify(message);
        console.log('Sending message string:', messageString);
        ws.send(messageString);
        console.log('Message sent successfully');
      } catch (error) {
        console.error('Error sending message to client:', error);
      }
    } else {
      console.log('WebSocket not open, cannot send message');
    }
  }

  // Broadcast message to all connected clients
  broadcastToAll(message) {
    this.clients.forEach((ws) => {
      this.sendToClient(ws, message);
    });
  }

  // Broadcast current game state to all connected clients
  broadcastGameState() {
    const message = {
      type: 'game_state_update',
      gameState: this.gameServer.getCleanGameState(),
      timestamp: Date.now()
    };

    this.broadcastToAll(message);
    console.log('Game state broadcasted to all clients');
  }

  // Enhanced method to broadcast specific events
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

  // Broadcast event to all clients except the specified one
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

  // Get connected clients count
  getConnectedClientsCount() {
    return this.clients.size;
  }

  // Get all connected player IDs
  getConnectedPlayerIds() {
    return Array.from(this.clients.keys());
  }

  // ✅ ROOT CAUSE FIX: Validate connection limits per IP
  validateConnectionLimit(clientIP) {
    if (clientIP === 'unknown') return true; // Allow unknown IPs (fallback)

    // Count current connections from this IP
    let connectionsFromIP = 0;
    this.clients.forEach((ws) => {
      if (ws.clientIP === clientIP) {
        connectionsFromIP++;
      }
    });

    console.log(`🔍 IP ${clientIP} has ${connectionsFromIP} active connections (max: ${this.maxConnectionsPerIP})`);
    return connectionsFromIP < this.maxConnectionsPerIP;
  }

  // ✅ FIXED: Intelligent join rate limiting per IP
  validateJoinRateLimit(clientIP) {
    if (clientIP === 'unknown') return true; // Allow unknown IPs (fallback)

    const now = Date.now();
    const connectionData = this.connectionAttempts.get(clientIP);

    if (!connectionData) {
      // First connection from this IP - always allow
      this.connectionAttempts.set(clientIP, { count: 1, lastAttempt: now, firstAttempt: now });
      console.log(`✅ First join attempt from IP ${clientIP} - allowed`);
      return true;
    }

    const timeSinceLastAttempt = now - connectionData.lastAttempt;
    const timeSinceFirstAttempt = now - connectionData.firstAttempt;

    // Allow if enough time has passed since last attempt (normal reconnection)
    if (timeSinceLastAttempt >= this.ipRateLimit) {
      // Reset counter if it's been a while since first attempt (> 30 seconds)
      if (timeSinceFirstAttempt > 30000) {
        this.connectionAttempts.set(clientIP, { count: 1, lastAttempt: now, firstAttempt: now });
        console.log(`✅ IP ${clientIP} rate limit reset after ${timeSinceFirstAttempt}ms - allowed`);
      } else {
        // Update existing data
        connectionData.count++;
        connectionData.lastAttempt = now;
        console.log(`✅ IP ${clientIP} join allowed (${timeSinceLastAttempt}ms since last, attempt #${connectionData.count})`);
      }
      return true;
    }

    // Block if too many rapid attempts (more than 3 attempts in quick succession)
    if (connectionData.count >= 3 && timeSinceFirstAttempt < 10000) {
      console.log(`🚨 Rate limit: IP ${clientIP} made ${connectionData.count} attempts in ${timeSinceFirstAttempt}ms (blocked)`);
      return false;
    }

    // Allow occasional quick attempts (up to 3 within 10 seconds)
    connectionData.count++;
    connectionData.lastAttempt = now;
    console.log(`⚠️  IP ${clientIP} quick join attempt #${connectionData.count} (${timeSinceLastAttempt}ms ago) - allowed with warning`);
    return true;
  }

  // ✅ FIXED: Clean up stale data periodically
  cleanupPendingJoins() {
    const now = Date.now();
    const pendingTimeout = 30000; // 30 seconds timeout for pending joins
    const connectionTimeout = 300000; // 5 minutes timeout for connection attempts

    // Clean up stale pending joins
    for (const [nickname, data] of this.pendingJoins.entries()) {
      if (now - data.timestamp > pendingTimeout) {
        console.log(`🧹 Cleaning up stale pending join for "${nickname}"`);
        this.pendingJoins.delete(nickname);
      }
    }

    // Clean up old connection attempt data
    for (const [ip, data] of this.connectionAttempts.entries()) {
      if (now - data.firstAttempt > connectionTimeout) {
        console.log(`🧹 Cleaning up old connection data for IP ${ip}`);
        this.connectionAttempts.delete(ip);
      }
    }
  }
}

module.exports = WebSocketManager;
