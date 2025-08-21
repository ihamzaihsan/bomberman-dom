export class WebSocketManager {
  constructor(framework) {
    this.framework = framework;
    this.ws = null;
    this.wsConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    this.messageHandlers = new Map();

    this.onConnectionSuccess = null;
    this.onConnectionError = null;
    this.onDisconnect = null;

    this.messageSequence = 0;
  }

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

  handleWebSocketMessage(data) {
    const timestamp = new Date().toISOString();
    console.log(`=== CLIENT WEBSOCKET MESSAGE RECEIVED [${timestamp}] ===`);
    console.log('Message type:', data.type);
    console.log('Message sequence number:', this.messageSequence++);

    if (data.type === 'join_success' || data.type === 'join_error') {
      console.log(`🔥 CRITICAL MESSAGE: ${data.type}`);
      if (data.type === 'join_success') {
        console.log('🎉 Player nickname from server:', data.player?.nickname);
      } else if (data.type === 'join_error') {
        console.log('❌ Error message from server:', data.message);
      }
    }

    console.log('Full message data:', data);

    const handler = this.messageHandlers.get(data.type);
    if (handler) {
      console.log(`📞 Calling handler for ${data.type}...`);
      handler(data);
      console.log(`✅ Handler for ${data.type} completed`);
    } else {
      console.warn('No handler registered for message type:', data.type);
    }
  }

  registerMessageHandler(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  unregisterMessageHandler(messageType) {
    this.messageHandlers.delete(messageType);
  }

  showConnectionError(message) {
    let errorDiv = this.framework.find('#connection-error');
    if (!errorDiv) {
      errorDiv = this.framework.selectiveRenderer.createElement('div', {
        id: 'connection-error',
        style: `
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
      `
      });
      document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  hideConnectionError() {
    const errorDiv = this.framework.find('#connection-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  setConnectionCallbacks(callbacks) {
    this.onConnectionSuccess = callbacks.onSuccess || null;
    this.onConnectionError = callbacks.onError || null;
    this.onDisconnect = callbacks.onDisconnect || null;
  }

  isConnected() {
    return this.wsConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.wsConnected = false;
    }
  }

  reset() {
    this.close();
    this.reconnectAttempts = 0;
    this.messageHandlers.clear();
  }
}
