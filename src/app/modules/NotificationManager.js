export class NotificationManager {
  constructor(framework) {
    this.framework = framework;
    this.notificationQueue = [];
    this.isProcessingQueue = false;
    this.currentNotificationTimeout = null;
  }

  showNotification(message, type = 'success') {
    const isWelcomeMessage =
      message.toLowerCase().includes('welcome') ||
      message.includes('🎉') ||
      message.includes('joined successfully');
    const isNameLimitMessage =
      message.toLowerCase().includes('character limit') ||
      message.toLowerCase().includes('name too long');

    if (isNameLimitMessage && this.lastMessageWasWelcome) {
      return;
    }

    if (isWelcomeMessage) {
      this.notificationQueue = [];
      if (this.currentNotificationTimeout) {
        clearTimeout(this.currentNotificationTimeout);
        this.currentNotificationTimeout = null;
      }
    }

    const notification = {
      message,
      type,
      priority: isWelcomeMessage ? 2 : 0,
      timestamp: Date.now(),
      isWelcomeMessage,
    };

    this.notificationQueue.push(notification);

    try {
      if (isWelcomeMessage) {
        this.framework.set('notifications', []);
      }
      this.framework.push('notifications', {
        message,
        type,
        timestamp: notification.timestamp,
        priority: notification.priority,
      });
    } catch (e) {
      console.warn('Failed to mirror notification to framework state:', e);
    }

    this.lastMessageWasWelcome = isWelcomeMessage;

    this.notificationQueue.sort((a, b) => b.priority - a.priority);

    if (isWelcomeMessage || !this.isProcessingQueue) {
      this.processNotificationQueue();
    }
  }

  processNotificationQueue() {
    if (this.notificationQueue.length === 0) {
      this.isProcessingQueue = false;
      this.lastMessageWasWelcome = false;
      return;
    }

    this.isProcessingQueue = true;
    const notification = this.notificationQueue.shift();

    this.displayNotification(notification.message, notification.type);

    const delay = notification.isWelcomeMessage ? 4000 : 3000;

    this.currentNotificationTimeout = setTimeout(() => {
      this.processNotificationQueue();
    }, delay);
  }

  displayNotification(message, type) {
    if (this.currentNotificationTimeout) {
      clearTimeout(this.currentNotificationTimeout);
    }

    let notificationArea = this.framework.find('#notification-area');
    if (!notificationArea) {
      notificationArea = this.framework.createElement('div', {
        id: 'notification-area',
        style: `
          position: fixed; top: 20px; right: 20px; z-index: 9999;
          min-width: 200px; padding: 12px 20px; border-radius: 6px;
          font-size: 15px; font-family: inherit; color: #fff;
          background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
          box-shadow: 0 2px 8px rgba(0,0,0,0.15); opacity: 0.95;
          transition: opacity 0.3s;
        `,
      });
      document.body.appendChild(notificationArea);
    }

    notificationArea.style.background = type === 'error' ? '#e74c3c' : '#27ae60';
    notificationArea.textContent = message;
    notificationArea.style.display = 'block';

    setTimeout(() => {
      if (notificationArea.textContent === message) {
        notificationArea.style.display = 'none';
      }
    }, 2500);
  }

  showError(message) {
    this.showNotification(message, 'error');
  }
}
