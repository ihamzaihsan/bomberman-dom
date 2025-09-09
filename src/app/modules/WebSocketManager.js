export class WebSocketManager {
  constructor(framework) {
    this.framework = framework;
    this.ws = null;
    this.wsConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.reconnectTimer = null;
    this.closed = false;
    this.messageHandlers = new Map();
  }

  initWebSocket() {
    this.closed = false;
    clearTimeout(this.reconnectTimer);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    this.ws = socket;
    socket.onopen = (event) => {
      if (socket !== this.ws) return;
      this.wsConnected = true;
      this.reconnectAttempts = 0;
      this.hideConnectionError();
      this.onConnectionSuccess?.(event);
    };
    socket.onmessage = (event) => {
      if (socket !== this.ws) return;
      try {
        this.handleWebSocketMessage(JSON.parse(event.data));
      } catch (error) {
        console.error('Unable to process server message:', error);
      }
    };
    socket.onclose = (event) => {
      if (socket !== this.ws) return;
      this.wsConnected = false;
      this.onDisconnect?.(event);
      if (!this.closed) this.handleWebSocketDisconnect();
    };
    socket.onerror = (error) => {
      if (socket !== this.ws) return;
      this.showConnectionError('Unable to connect to the game server');
      this.onConnectionError?.(error);
    };
  }

  handleWebSocketDisconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showConnectionError('Connection lost. Refresh to try again.');
      return;
    }
    this.reconnectAttempts++;
    this.showConnectionError(
      `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})?`,
    );
    this.reconnectTimer = setTimeout(() => {
      if (!this.closed) this.initWebSocket();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  sendWebSocketMessage(message) {
    if (!this.isConnected()) return false;
    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Unable to send message:', error);
      return false;
    }
  }

  handleWebSocketMessage(data) {
    this.messageHandlers.get(data.type)?.(data);
  }
  registerMessageHandler(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  showConnectionError(message) {
    let banner = document.getElementById('connection-error');
    if (!banner) {
      banner = this.framework.createElement('div', {
        id: 'connection-error',
        role: 'status',
        className: 'connection-banner',
      });
      document.body.appendChild(banner);
    }
    banner.textContent = message;
    banner.hidden = false;
  }
  hideConnectionError() {
    const banner = document.getElementById('connection-error');
    if (banner) banner.hidden = true;
  }
  setConnectionCallbacks(callbacks) {
    this.onConnectionSuccess = callbacks.onSuccess;
    this.onConnectionError = callbacks.onError;
    this.onDisconnect = callbacks.onDisconnect;
  }
  isConnected() {
    return this.wsConnected && this.ws?.readyState === WebSocket.OPEN;
  }
  close() {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    const socket = this.ws;
    this.ws = null;
    this.wsConnected = false;
    socket?.close();
  }
}
