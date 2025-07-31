// ChatManager: Handles chat message logic and UI
export class ChatManager {
  constructor(app) {
    this.app = app;
    this.chatMessages = [];
    this.maxChatMessages = 50;
  }

  // Clear chat history (called when starting new games)
  clearChatHistory() {
    this.chatMessages = [];
    this.updateChatDisplay();
  }

  handleChatMessage(data) {
    this.chatMessages.push({
      playerId: data.playerId,
      nickname: data.nickname,
      message: data.message,
      timestamp: data.timestamp,
    });
    if (this.chatMessages.length > this.maxChatMessages) {
      this.chatMessages = this.chatMessages.slice(-this.maxChatMessages);
    }
    this.updateChatDisplay();
  }

  updateChatDisplay() {
    // Waiting room chat
    const chatContainer = document.getElementById("chat-messages");
    if (chatContainer) {
      chatContainer.innerHTML = this.chatMessages
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
    const gameChatContainer = document.getElementById("game-chat-messages");
    if (gameChatContainer) {
      gameChatContainer.innerHTML = this.chatMessages
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
    // Remove existing handlers first
    this.removeChatHandlers();

    const chatInput = document.getElementById("chat-input");
    const chatSend = document.getElementById("chat-send");
    if (chatInput && chatSend) {
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
  }

  removeChatHandlers() {
    const chatInput = document.getElementById("chat-input");
    const chatSend = document.getElementById("chat-send");

    if (chatSend && this.chatSendHandler) {
      chatSend.removeEventListener("click", this.chatSendHandler);
    }
    if (chatInput && this.chatKeyHandler) {
      chatInput.removeEventListener("keypress", this.chatKeyHandler);
    }
  }

  setupGameChatHandlers() {
    // Remove existing handlers first
    this.removeGameChatHandlers();

    const gameChatInput = document.getElementById("game-chat-input");
    const gameChatSend = document.getElementById("game-chat-send");
    if (gameChatInput && gameChatSend) {
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
  }

  removeGameChatHandlers() {
    const gameChatInput = document.getElementById("game-chat-input");
    const gameChatSend = document.getElementById("game-chat-send");

    if (gameChatSend && this.gameChatSendHandler) {
      gameChatSend.removeEventListener("click", this.gameChatSendHandler);
    }
    if (gameChatInput && this.gameChatKeyHandler) {
      gameChatInput.removeEventListener("keypress", this.gameChatKeyHandler);
    }
  }
}
