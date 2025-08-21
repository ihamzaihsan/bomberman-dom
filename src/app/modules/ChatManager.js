export class ChatManager {
  constructor(app) {
    this.app = app;
    this.maxChatMessages = 50;
  }

  clearChatHistory() {
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

    this.app.framework.push('chatHistory', chatMessage);
    
    const chatHistory = this.app.framework.get('chatHistory') || [];
    if (chatHistory.length > this.maxChatMessages) {
      this.app.framework.set('chatHistory', chatHistory.slice(-this.maxChatMessages));
    }
    
    this.updateChatDisplay();
  }

  updateChatDisplay() {
    const chatMessages = this.app.framework.get('chatHistory') || [];
    
    const renderMessages = (container) => {
      container.innerHTML = '';
      chatMessages.forEach(msg => {
        const messageContainer = this.app.framework.selectiveRenderer.createElement('div', { className: 'chat-message' });
        const nickname = this.app.framework.selectiveRenderer.createElement('span', { className: 'chat-nickname', textContent: `${msg.nickname}:` });
        const message = this.app.framework.selectiveRenderer.createElement('span', { className: 'chat-text', textContent: msg.message });
        messageContainer.appendChild(nickname);
        messageContainer.appendChild(message);
        container.appendChild(messageContainer);
      });
      container.scrollTop = container.scrollHeight;
    };

    const chatContainer = this.app.framework.find('#chat-messages');
    if (chatContainer) {
      renderMessages(chatContainer);
    }
    
    const gameChatContainer = this.app.framework.find('#game-chat-messages');
    if (gameChatContainer) {
      renderMessages(gameChatContainer);
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
    this.removeChatHandlers();

    setTimeout(() => {
      const chatInput = this.app.framework.find('#chat-input');
      const chatSend = this.app.framework.find('#chat-send');
      if (chatInput && chatSend) {
        console.log('🔧 ChatManager: Adding chat event listeners');
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

        this.app.framework.eventManager.click('#chat-send', this.chatSendHandler);
        this.app.framework.eventManager.keypress('#chat-input', this.chatKeyHandler);
      }
    }, 50);
  }

  removeChatHandlers() {
    console.log('🔧 ChatManager: Removing chat handlers');
    if (this.chatSendHandler) {
      this.app.framework.eventManager.off('click', '#chat-send', this.chatSendHandler);
      this.chatSendHandler = null;
    }
    if (this.chatKeyHandler) {
      this.app.framework.eventManager.off('keypress', '#chat-input', this.chatKeyHandler);
      this.chatKeyHandler = null;
    }
  }

  setupGameChatHandlers() {
    console.log('🔧 ChatManager: Setting up game chat handlers');
    this.removeGameChatHandlers();

    setTimeout(() => {
      const gameChatInput = this.app.framework.find('#game-chat-input');
      const gameChatSend = this.app.framework.find('#game-chat-send');
      if (gameChatInput && gameChatSend) {
        console.log('🔧 ChatManager: Adding game chat event listeners');
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

        this.app.framework.eventManager.click('#game-chat-send', this.gameChatSendHandler);
        this.app.framework.eventManager.keypress('#game-chat-input', this.gameChatKeyHandler);
      }
    }, 50);
  }

  removeGameChatHandlers() {
    console.log('🔧 ChatManager: Removing game chat handlers');
    if (this.gameChatSendHandler) {
      this.app.framework.eventManager.off('click', '#game-chat-send', this.gameChatSendHandler);
      this.gameChatSendHandler = null;
    }
    if (this.gameChatKeyHandler) {
      this.app.framework.eventManager.off('keypress', '#game-chat-input', this.gameChatKeyHandler);
      this.gameChatKeyHandler = null;
    }
  }
}
