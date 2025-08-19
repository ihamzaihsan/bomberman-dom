/**
 * NotificationManager: Handles notifications and error messages for the app
 * Implements a priority-based queue system to prevent race conditions
 */
export class NotificationManager {
  constructor(framework) {
    this.framework = framework;
    this.notificationQueue = [];
    this.isProcessingQueue = false;
    this.currentNotificationTimeout = null;
  }

  showNotification(message, type = "success") {
    console.log(`Queuing notification: "${message}" (type: ${type})`);

    // Add to queue with priority (welcome messages get higher priority)
    const isWelcomeMessage = message.includes('WELCOME') || message.includes('Welcome');
    const notification = {
      message,
      type,
      priority: isWelcomeMessage ? 1 : 0,
      timestamp: Date.now()
    };

    this.notificationQueue.push(notification);

    // Mirror into framework state with size limiting
    try {
      this.framework.push('notifications', { message, type, timestamp: notification.timestamp });
      const notifications = this.framework.get('notifications') || [];
      const max = 50;
      if (notifications.length > max) {
        this.framework.set('notifications', notifications.slice(-max));
      }
    } catch (e) {
      console.warn('Failed to mirror notification to framework state:', e);
    }

    // Sort queue by priority (higher priority first)
    this.notificationQueue.sort((a, b) => b.priority - a.priority);

    console.log(`Notification queue length: ${this.notificationQueue.length}`);

    if (!this.isProcessingQueue) {
      this.processNotificationQueue();
    }
  }

  processNotificationQueue() {
    if (this.notificationQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;
    const notification = this.notificationQueue.shift();

    console.log(`Displaying notification: "${notification.message}" (type: ${notification.type})`);

    this.displayNotification(notification.message, notification.type);

    // Process next notification after current one finishes
    this.currentNotificationTimeout = setTimeout(() => {
      this.processNotificationQueue();
    }, 3000);
  }

  displayNotification(message, type) {
    if (this.currentNotificationTimeout) {
      clearTimeout(this.currentNotificationTimeout);
    }

    let notificationArea = document.getElementById("notification-area");
    if (!notificationArea) {
      notificationArea = document.createElement("div");
      notificationArea.id = "notification-area";
      notificationArea.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        min-width: 200px; padding: 12px 20px; border-radius: 6px;
        font-size: 15px; font-family: inherit; color: #fff;
        background: ${type === "error" ? "#e74c3c" : "#27ae60"};
        box-shadow: 0 2px 8px rgba(0,0,0,0.15); opacity: 0.95;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(notificationArea);
    }

    notificationArea.style.background = type === "error" ? "#e74c3c" : "#27ae60";
    notificationArea.textContent = message;
    notificationArea.style.display = "block";

    setTimeout(() => {
      if (notificationArea.textContent === message) {
        notificationArea.style.display = "none";
      }
    }, 2500);
  }

  showError(message) {
    this.showNotification(message, "error");
  }
}
