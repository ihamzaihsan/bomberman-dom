// ChatManager: Handles chat message logic and UI
export class ChatManager {
  constructor(app) {
    this.app = app;
    // ✅ NEW: Remove local chat storage - use framework state instead
    this.maxChatMessages = 50;
  }

  // Clear chat history (called when starting new games)
  clearChatHistory() {
    // ✅ NEW: Use framework state management for chat
    this.app.framework.set('chatHistory', []);
    this.updateChatDisplay();
  }

  handleChatMessage(data) {
    const chatMessage = {
      playerId: data.playerId,
      nickname: data.nickname,
      message: data.message,
      timestamp: data.timestamp,
    };

    // ✅ NEW: Use framework state management to add chat message
    this.app.framework.push('chatHistory', chatMessage);
    
    // Limit chat history size
    const chatHistory = this.app.framework.get('chatHistory') || [];
    if (chatHistory.length > this.maxChatMessages) {
      this.app.framework.set('chatHistory', chatHistory.slice(-this.maxChatMessages));
    }
    
    this.updateChatDisplay();
  }

  updateChatDisplay() {
    // ✅ NEW: Get chat messages from framework state
    const chatMessages = this.app.framework.get('chatHistory') || [];
    
    // Waiting room chat
    const chatContainer = this.app.framework.find('#chat-messages');
    if (chatContainer) {
      chatContainer.innerHTML = chatMessages
        .map(
          (msg) => `
        <div class="chat-message">
          <span class="chat-nickname">${msg.nickname}:</span>
          <span class="chat-text">${msg.message}</span>
        </div>
      `
        )
        .join("");
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    // Game screen chat
    const gameChatContainer = this.app.framework.find('#game-chat-messages');
    if (gameChatContainer) {
      gameChatContainer.innerHTML = chatMessages
        .map(
          (msg) => `
        <div class="chat-message">
          <span class="chat-nickname">${msg.nickname}:</span>
          <span class="chat-text">${msg.message}</span>
        </div>
      `
        )
        .join("");
      gameChatContainer.scrollTop = gameChatContainer.scrollHeight;
    }
  }

  sendChatMessage(message) {
    if (!message.trim()) return;
    const success = this.app.sendWebSocketMessage({
      type: "chat",
      message: message.trim(),
    });
    if (!success) {
      this.app.notificationManager?.showError("Failed to send chat message");
    }
  }

  setupChatHandlers() {
    console.log('🔧 ChatManager: Setting up chat handlers');
    // Remove existing handlers first with extra safety
    this.removeChatHandlers();

    // Add small delay to ensure cleanup is complete
    setTimeout(() => {
      const chatInput = this.app.framework.find('#chat-input');
      const chatSend = this.app.framework.find('#chat-send');
      if (chatInput && chatSend) {
        console.log('🔧 ChatManager: Adding chat event listeners');
        // Store handlers for cleanup
        this.chatSendHandler = () => {
          const message = chatInput.value;
          if (message.trim()) {
            this.sendChatMessage(message);
            chatInput.value = "";
          }
        };

        this.chatKeyHandler = (e) => {
          if (e.key === "Enter") {
            const message = chatInput.value;
            if (message.trim()) {
              this.sendChatMessage(message);
              chatInput.value = "";
            }
          }
        };

        chatSend.addEventListener("click", this.chatSendHandler);
        chatInput.addEventListener("keypress", this.chatKeyHandler);
      }
    }, 50);
  }

  removeChatHandlers() {
    console.log('🔧 ChatManager: Removing chat handlers');
    const chatInput = this.app.framework.find('#chat-input');
    const chatSend = this.app.framework.find('#chat-send');

    if (chatSend && this.chatSendHandler) {
      chatSend.removeEventListener("click", this.chatSendHandler);
      this.chatSendHandler = null;
    }
    if (chatInput && this.chatKeyHandler) {
      chatInput.removeEventListener("keypress", this.chatKeyHandler);
      this.chatKeyHandler = null;
    }
  }

  setupGameChatHandlers() {
    console.log('🔧 ChatManager: Setting up game chat handlers');
    // Remove existing handlers first with extra safety
    this.removeGameChatHandlers();

    // Add small delay to ensure cleanup is complete
    setTimeout(() => {
      const gameChatInput = this.app.framework.find('#game-chat-input');
      const gameChatSend = this.app.framework.find('#game-chat-send');
      if (gameChatInput && gameChatSend) {
        console.log('🔧 ChatManager: Adding game chat event listeners');
        // Store handlers for cleanup
        this.gameChatSendHandler = () => {
          const message = gameChatInput.value;
          if (message.trim()) {
            this.sendChatMessage(message);
            gameChatInput.value = "";
          }
        };

        this.gameChatKeyHandler = (e) => {
          if (e.key === "Enter") {
            const message = gameChatInput.value;
            if (message.trim()) {
              this.sendChatMessage(message);
              gameChatInput.value = "";
            }
          }
        };

        gameChatSend.addEventListener("click", this.gameChatSendHandler);
        gameChatInput.addEventListener("keypress", this.gameChatKeyHandler);
      }
    }, 50);
  }

  removeGameChatHandlers() {
    console.log('🔧 ChatManager: Removing game chat handlers');
    const gameChatInput = this.app.framework.find('#game-chat-input');
    const gameChatSend = this.app.framework.find('#game-chat-send');

    if (gameChatSend && this.gameChatSendHandler) {
      gameChatSend.removeEventListener("click", this.gameChatSendHandler);
      this.gameChatSendHandler = null;
    }
    if (gameChatInput && this.gameChatKeyHandler) {
      gameChatInput.removeEventListener("keypress", this.gameChatKeyHandler);
      this.gameChatKeyHandler = null;
    }
  }
}
