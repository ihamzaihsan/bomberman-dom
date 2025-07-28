export class WebSocketManager {
  constructor() {
    // WebSocket connection
    this.ws = null;
    this.wsConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    // Message handlers
    this.messageHandlers = new Map();
    
    // Event callbacks
    this.onConnectionSuccess = null;
    this.onConnectionError = null;
    this.onDisconnect = null;
  }

  // Initialize WebSocket connection
  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Connecting to WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = (event) => {
        console.log('WebSocket connected successfully');
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.hideConnectionError();
        
        if (this.onConnectionSuccess) {
          this.onConnectionSuccess(event);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.wsConnected = false;
        this.handleWebSocketDisconnect();
        
        if (this.onDisconnect) {
          this.onDisconnect(event);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.wsConnected = false;
        this.showConnectionError('Connection error occurred');
        
        if (this.onConnectionError) {
          this.onConnectionError(error);
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.showConnectionError('Failed to connect to server');
      
      if (this.onConnectionError) {
        this.onConnectionError(error);
      }
    }
  }

  // Handle WebSocket disconnection and reconnection
  handleWebSocketDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      this.showConnectionError(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.initWebSocket();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      this.showConnectionError('Connection lost. Please refresh the page.');
    }
  }

  // Send message via WebSocket
  sendWebSocketMessage(message) {
    console.log('=== SENDING WEBSOCKET MESSAGE ===');
    console.log('Message:', message);
    console.log('WebSocket exists:', !!this.ws);
    console.log('WebSocket connected:', this.wsConnected);
    console.log('WebSocket ready state:', this.ws ? this.ws.readyState : 'no websocket');
    console.log('WebSocket.OPEN constant:', WebSocket.OPEN);

    if (this.ws && this.wsConnected && this.ws.readyState === WebSocket.OPEN) {
      try {
        const messageString = JSON.stringify(message);
        console.log('Sending message string:', messageString);
        this.ws.send(messageString);
        console.log('Message sent successfully');
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
      console.warn('Conditions:', {
        wsExists: !!this.ws,
        wsConnected: this.wsConnected,
        readyState: this.ws ? this.ws.readyState : 'no websocket',
        expectedState: WebSocket.OPEN
      });
      return false;
    }
  }

  // Handle incoming WebSocket messages
  handleWebSocketMessage(data) {
    console.log('=== CLIENT WEBSOCKET MESSAGE RECEIVED ===');
    console.log('Message type:', data.type);
    console.log('Full message data:', data);

    // Look for registered message handler
    const handler = this.messageHandlers.get(data.type);
    if (handler) {
      handler(data);
    } else {
      console.warn('No handler registered for message type:', data.type);
    }
  }

  // Register message handler for specific message type
  registerMessageHandler(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  // Unregister message handler
  unregisterMessageHandler(messageType) {
    this.messageHandlers.delete(messageType);
  }

  // Show/hide connection error
  showConnectionError(message) {
    let errorDiv = document.getElementById('connection-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'connection-error';
      errorDiv.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #e74c3c;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10001;
        font-weight: bold;
      `;
      document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  hideConnectionError() {
    const errorDiv = document.getElementById('connection-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  // Set connection event callbacks
  setConnectionCallbacks(callbacks) {
    this.onConnectionSuccess = callbacks.onSuccess || null;
    this.onConnectionError = callbacks.onError || null;
    this.onDisconnect = callbacks.onDisconnect || null;
  }

  // Get connection status
  isConnected() {
    return this.wsConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Close WebSocket connection
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.wsConnected = false;
    }
  }

  // Reset connection
  reset() {
    this.close();
    this.reconnectAttempts = 0;
    this.messageHandlers.clear();
  }
}
