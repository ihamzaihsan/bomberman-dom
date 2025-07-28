// ChatManager: Handles chat message logic and UI
export class ChatManager {
  constructor(app) {
    this.app = app;
    this.chatMessages = [];
    this.maxChatMessages = 50;
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
    const chatInput = document.getElementById("chat-input");
    const chatSend = document.getElementById("chat-send");
    if (chatInput && chatSend) {
      chatSend.addEventListener("click", () => {
        const message = chatInput.value;
        if (message.trim()) {
          this.sendChatMessage(message);
          chatInput.value = "";
        }
      });
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const message = chatInput.value;
          if (message.trim()) {
            this.sendChatMessage(message);
            chatInput.value = "";
          }
        }
      });
    }
  }

  setupGameChatHandlers() {
    const gameChatInput = document.getElementById("game-chat-input");
    const gameChatSend = document.getElementById("game-chat-send");
    if (gameChatInput && gameChatSend) {
      gameChatSend.addEventListener("click", () => {
        const message = gameChatInput.value;
        if (message.trim()) {
          this.sendChatMessage(message);
          gameChatInput.value = "";
        }
      });
      gameChatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const message = gameChatInput.value;
          if (message.trim()) {
            this.sendChatMessage(message);
            gameChatInput.value = "";
          }
        }
      });
    }
  }
}
