const WebSocket = require('ws');

class WebSocketManager {
  constructor(gameServer) {
    this.gameServer = gameServer;
    this.clients = new Map(); // Map of playerId -> WebSocket connection
    this.wss = null; // WebSocket server instance
    
    console.log('WebSocketManager initialized');
  }

  // Initialize WebSocket server
  initWebSocketServer(server) {
    this.wss = new WebSocket.Server({ server });
    
    this.wss.on('connection', (ws, req) => {
      console.log('New WebSocket connection established');
      
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

    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    console.log('Generated player ID:', playerId);

    console.log('Calling gameServer.addPlayer...');
    const result = this.gameServer.addPlayer(playerId, nickname);
    console.log('addPlayer result:', result);
    
    if (result.success) {
      console.log('Join successful, processing...');

      // Store the WebSocket connection for this player
      this.clients.set(playerId, ws);
      ws.playerId = playerId; // Store playerId on the WebSocket for easy access
      console.log('Stored WebSocket connection for player:', playerId);

      // Send success response to the joining player
      const joinSuccessMessage = {
        type: 'join_success',
        playerId: playerId,
        player: result.player,
        gameState: this.gameServer.getCleanGameState()
      };

      console.log('Sending join_success to player:', playerId);
      console.log('Join success message:', joinSuccessMessage);
      this.sendToClient(ws, joinSuccessMessage);

      // ✅ FIX: Sequence WebSocket messages with proper timing to prevent race conditions
      setTimeout(() => {
        // Broadcast player join event to OTHER players (not the joining player)
        console.log('Broadcasting player_joined event to other players...');
        this.broadcastEventExcept(ws, 'player_joined', {
          playerId: playerId,
          nickname: nickname,
          playerCount: Object.keys(this.gameServer.getGameState().players).length
        });

        // Broadcast updated game state to all players after a small delay
        setTimeout(() => {
          console.log('Broadcasting game state update...');
          this.broadcastGameState();
        }, 50); // Small delay to ensure proper message sequencing
      }, 100); // Allow join_success to be processed first

      console.log(`Player ${nickname} joined via WebSocket with ID: ${playerId}`);
    } else {
      console.log('Join failed:', result.error);
      this.sendToClient(ws, {
        type: 'join_error',
        message: result.error
      });
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
    
    const success = this.gameServer.placeBomb(playerId);
    
    if (success) {
      // Broadcast updated game state to all players
      this.broadcastGameState();
    }
    
    // Send bomb placement result to the requesting player
    this.sendToClient(ws, {
      type: 'bomb_result',
      success: success
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
}

module.exports = WebSocketManager;
