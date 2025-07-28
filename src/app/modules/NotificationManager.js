// NotificationManager: Handles notifications and error messages for the app
export class NotificationManager {
  constructor(framework) {
    this.framework = framework;
    // Optionally, cache notification elements here
  }

  showNotification(message, type = "success") {
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
    notificationArea.textContent = message;
    notificationArea.style.display = "block";
    setTimeout(() => {
      notificationArea.style.display = "none";
    }, 2500);
  }

  showError(message) {
    this.showNotification(message, "error");
  }
}
