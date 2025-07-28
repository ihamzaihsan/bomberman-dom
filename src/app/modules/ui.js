// UI/Notification feature module
export function showNotification(app, message, type = "success") {
  let notificationDiv = document.getElementById("game-notification");
  if (!notificationDiv) {
    notificationDiv = document.createElement("div");
    notificationDiv.id = "game-notification";
    notificationDiv.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 10002;
      font-weight: bold;
      opacity: 0;
      transition: opacity 0.3s;
      max-width: 400px;
      text-align: center;
    `;
    document.body.appendChild(notificationDiv);
  }
  const colors = {
    success: "#27ae60",
    damage: "#e74c3c",
    warning: "#f39c12",
    info: "#3498db",
  };
  notificationDiv.style.background = colors[type] || colors.success;
  notificationDiv.textContent = message;
  notificationDiv.style.opacity = "1";
  const durations = {
    success: 3000,
    damage: 4000,
    warning: 3500,
    info: 3000,
  };
  setTimeout(() => {
    notificationDiv.style.opacity = "0";
  }, durations[type] || 3000);
}

export function showError(app, message) {
  const errorElement = document.getElementById("error-message");
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = "block";
    setTimeout(() => {
      errorElement.style.display = "none";
    }, 5000);
  }
}
