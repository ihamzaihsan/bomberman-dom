// NotificationManager: Handles notifications and error messages for the app
export class NotificationManager {
  constructor(framework) {
    this.framework = framework;
    // ✅ CRITICAL FIX: Add notification queue to prevent race conditions
    this.notificationQueue = [];
    this.isProcessingQueue = false;
    this.currentNotificationTimeout = null;
  }

  showNotification(message, type = "success") {
    // ✅ CRITICAL FIX: Queue notifications to prevent race conditions
    console.log(`🔔 QUEUING NOTIFICATION: "${message}" (type: ${type})`);

    // Add to queue with priority (welcome messages get higher priority)
    const isWelcomeMessage = message.includes('WELCOME') || message.includes('Welcome');
    const notification = {
      message,
      type,
      priority: isWelcomeMessage ? 1 : 0,
      timestamp: Date.now()
    };

    this.notificationQueue.push(notification);

    // Sort queue by priority (higher priority first)
    this.notificationQueue.sort((a, b) => b.priority - a.priority);

    console.log(`📋 Notification queue length: ${this.notificationQueue.length}`);

    // Process queue if not already processing
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

    console.log(`🎯 DISPLAYING NOTIFICATION: "${notification.message}" (type: ${notification.type})`);

    this.displayNotification(notification.message, notification.type);

    // Process next notification after current one finishes
    this.currentNotificationTimeout = setTimeout(() => {
      this.processNotificationQueue();
    }, 3000); // Slightly longer than display time to prevent overlap
  }

  displayNotification(message, type) {
    // Clear any existing timeout
    if (this.currentNotificationTimeout) {
      clearTimeout(this.currentNotificationTimeout);
    }

    // Example: Show notification in a dedicated UI area
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

    // ✅ BUG FIX: Update background color for each notification
    notificationArea.style.background = type === "error" ? "#e74c3c" : "#27ae60";
    notificationArea.textContent = message;
    notificationArea.style.display = "block";

    // Hide notification after display time
    setTimeout(() => {
      if (notificationArea.textContent === message) {
        // Only hide if this is still the current message
        notificationArea.style.display = "none";
      }
    }, 2500);
  }

  showError(message) {
    this.showNotification(message, "error");
  }
}
