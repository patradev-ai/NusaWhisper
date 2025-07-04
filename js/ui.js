// Enhanced UI management for room-based chat
class UI {
  constructor() {
    this.currentTheme = localStorage.getItem("theme") || "light";
    this.isModalOpen = false;
    this.toastQueue = [];
    this.maxToasts = 3;
    this.currentUserInfoAddress = null;

    this.init();
  }

  init() {
    // Apply saved theme
    this.applyTheme();

    // Update theme toggle icon
    this.updateThemeToggleIcon();

    // Initialize toast container
    this.initializeToastContainer();

    // Initialize responsive handlers
    this.initResponsiveHandlers();
  }

  applyTheme() {
    const html = document.documentElement;
    if (this.currentTheme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === "light" ? "dark" : "light";
    localStorage.setItem("theme", this.currentTheme);
    this.applyTheme();
    this.updateThemeToggleIcon();

    // Show toast notification
    this.showToast(`Switched to ${this.currentTheme} theme`, "info");
  }

  updateThemeToggleIcon() {
    const themeIcon = document.querySelector("#themeToggle i");
    if (themeIcon) {
      themeIcon.className =
        this.currentTheme === "light"
          ? "fas fa-moon text-gray-600 dark:text-gray-400"
          : "fas fa-sun text-gray-600 dark:text-gray-400";
    }
  }

  // Screen management
  showAuthScreen() {
    document.getElementById("authScreen").classList.remove("hidden");
    document.getElementById("chatScreen").classList.add("hidden");
    document.getElementById("sidebar").classList.add("hidden");
    this.clearAuthMessages();
  }

  showChatScreen() {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("chatScreen").classList.remove("hidden");

    // Show sidebar on desktop
    if (window.innerWidth >= 1024) {
      document.getElementById("sidebar").classList.remove("hidden");
    }
  }

  showAuthLoading() {
    document.getElementById("authLoading").classList.remove("hidden");
    document.getElementById("authError").classList.add("hidden");
    document.getElementById("connectWallet").disabled = true;
  }

  hideAuthLoading() {
    document.getElementById("authLoading").classList.add("hidden");
    document.getElementById("connectWallet").disabled = false;
  }

  showAuthError(message) {
    const errorElement = document.getElementById("authError");
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
    document.getElementById("authLoading").classList.add("hidden");
  }

  clearAuthMessages() {
    document.getElementById("authError").classList.add("hidden");
    document.getElementById("authLoading").classList.add("hidden");
  }

  // User interface updates
  updateUserAddress(address) {
    const userAddressElement = document.getElementById("userAddress");
    if (userAddressElement) {
      userAddressElement.textContent = address;
    }
  }

  updateSidebarUserInfo(user, nickname) {
    const sidebarUserName = document.getElementById("sidebarUserName");
    if (sidebarUserName) {
      sidebarUserName.textContent = nickname || user.shortAddress;
    }
  }

  updateOnlineStatusDisplay(isOnline) {
    const indicator = document.getElementById("onlineStatusIndicator");
    const text = document.getElementById("onlineStatusText");
    const toggle = document.getElementById("toggleOnlineStatus");

    if (indicator) {
      indicator.className = `w-2 h-2 rounded-full ${
        isOnline ? "bg-green-500" : "bg-gray-400"
      }`;
    }

    if (text) {
      text.textContent = isOnline ? "Online" : "Offline";
    }

    if (toggle) {
      toggle.className = `relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        isOnline ? "bg-green-500" : "bg-gray-300"
      }`;
      const span = toggle.querySelector("span:last-child");
      if (span) {
        span.className = `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          isOnline ? "translate-x-6" : "translate-x-1"
        }`;
      }
    }
  }

  // Modal management
  showUserModal() {
    const modal = document.getElementById("userModal");
    modal.classList.remove("hidden");
    this.isModalOpen = true;
  }

  hideUserModal() {
    const modal = document.getElementById("userModal");
    modal.classList.add("hidden");
    this.isModalOpen = false;
  }

  showUserInfoModal(userInfo) {
    this.currentUserInfoAddress = userInfo.address;

    const modal = document.getElementById("userInfoModal");
    const avatar = document.getElementById("userInfoAvatar");
    const nickname = document.getElementById("userInfoNickname");
    const address = document.getElementById("userInfoAddress");
    const status = document.getElementById("userInfoStatus");
    const joined = document.getElementById("userInfoJoined");

    if (avatar)
      avatar.textContent = userInfo.address.substring(2, 4).toUpperCase();
    if (nickname)
      nickname.textContent =
        userInfo.nickname || Utils.shortenAddress(userInfo.address);
    if (address) address.textContent = Utils.shortenAddress(userInfo.address);
    if (status) {
      status.textContent = userInfo.isOnline ? "Online" : "Offline";
      status.className = userInfo.isOnline ? "text-green-500" : "text-gray-400";
    }
    if (joined) {
      const joinedDate = new Date(userInfo.joinedAt);
      joined.textContent = Utils.formatTime(userInfo.joinedAt);
    }

    modal.classList.remove("hidden");
  }

  hideUserInfoModal() {
    const modal = document.getElementById("userInfoModal");
    modal.classList.add("hidden");
    this.currentUserInfoAddress = null;
  }

  showCreateRoomModal() {
    const modal = document.getElementById("createRoomModal");
    modal.classList.remove("hidden");

    // Focus on input
    setTimeout(() => {
      document.getElementById("roomNameInput").focus();
    }, 100);
  }

  hideCreateRoomModal() {
    const modal = document.getElementById("createRoomModal");
    modal.classList.add("hidden");

    // Clear form
    document.getElementById("roomNameInput").value = "";
    document.getElementById("privateRoomCheckbox").checked = false;
  }

  showJoinInviteModal() {
    const modal = document.getElementById("joinInviteModal");
    modal.classList.remove("hidden");

    // Focus on input
    setTimeout(() => {
      document.getElementById("inviteCodeInput").focus();
    }, 100);
  }

  hideJoinInviteModal() {
    const modal = document.getElementById("joinInviteModal");
    modal.classList.add("hidden");

    // Clear form
    document.getElementById("inviteCodeInput").value = "";
  }

  showRoomOptionsModal() {
    const modal = document.getElementById("roomOptionsModal");
    modal.classList.remove("hidden");
  }

  hideRoomOptionsModal() {
    const modal = document.getElementById("roomOptionsModal");
    modal.classList.add("hidden");
  }

  showDirectChatModal() {
    const modal = document.getElementById("directChatModal");
    modal.classList.remove("hidden");

    // Focus on input
    setTimeout(() => {
      document.getElementById("directChatAddress").focus();
    }, 100);
  }

  hideDirectChatModal() {
    const modal = document.getElementById("directChatModal");
    modal.classList.add("hidden");

    // Clear input
    document.getElementById("directChatAddress").value = "";
  }

  // Mobile sidebar
  showMobileSidebar() {
    const overlay = document.getElementById("mobileSidebarOverlay");
    const sidebar = document.getElementById("mobileSidebar");

    overlay.classList.remove("hidden");
    document.body.classList.add("mobile-sidebar-open");

    // Trigger animation
    setTimeout(() => {
      sidebar.classList.remove("-translate-x-full");
    }, 10);
  }

  hideMobileSidebar() {
    const overlay = document.getElementById("mobileSidebarOverlay");
    const sidebar = document.getElementById("mobileSidebar");

    sidebar.classList.add("-translate-x-full");
    document.body.classList.remove("mobile-sidebar-open");

    setTimeout(() => {
      overlay.classList.add("hidden");
    }, 300);
  }

  // Room management
  updateRoomList(userRooms, currentRoom = "general") {
    const roomList = document.getElementById("roomList");
    const roomListMobile = document.getElementById("roomListMobile");

    if (roomList) {
      roomList.innerHTML = "";
      this.populateRoomList(roomList, userRooms, currentRoom);
    }

    if (roomListMobile) {
      roomListMobile.innerHTML = "";
      this.populateRoomList(roomListMobile, userRooms, currentRoom);
    }
  }

  populateRoomList(container, userRooms, currentRoom) {
    userRooms.forEach((roomId) => {
      const roomItem = this.createRoomElement(roomId, roomId === currentRoom);
      container.appendChild(roomItem);
    });
  }

  createRoomElement(roomId, isActive = false) {
    const roomDiv = document.createElement("div");
    roomDiv.className = `room-item ${isActive ? "active" : ""}`;
    roomDiv.onclick = () => {
      if (window.app) {
        window.app.handleRoomSwitch(roomId);
      }
    };

    const roomIcon = document.createElement("div");
    roomIcon.className = "room-icon room-public";
    roomIcon.innerHTML = '<i class="fas fa-hashtag"></i>';

    const roomInfo = document.createElement("div");
    roomInfo.className = "flex-1";

    const roomName = document.createElement("div");
    roomName.className = "text-sm font-medium";
    roomName.textContent = roomId.charAt(0).toUpperCase() + roomId.slice(1);

    roomInfo.appendChild(roomName);
    roomDiv.appendChild(roomIcon);
    roomDiv.appendChild(roomInfo);

    return roomDiv;
  }

  updateChatHeader(roomName = "General", chatType = "room", memberCount = 0) {
    const chatTitle = document.getElementById("chatTitle");
    const chatIcon = document.getElementById("chatIcon");
    const onlineCount = document.getElementById("onlineCount");

    if (chatTitle) {
      if (chatType === "room") {
        chatTitle.textContent =
          roomName.charAt(0).toUpperCase() + roomName.slice(1);
      } else {
        chatTitle.textContent = "Direct Chat";
      }
    }

    if (chatIcon) {
      chatIcon.className =
        chatType === "room"
          ? "fas fa-hashtag text-white text-sm"
          : "fas fa-envelope text-white text-sm";
    }

    if (onlineCount) {
      onlineCount.textContent = memberCount;
    }
  }

  // Toast notifications
  showToast(message, type = "info", duration = 3000) {
    const toast = this.createToastElement(message, type);
    const container = document.getElementById("toastContainer");

    // Remove oldest toast if we have too many
    if (this.toastQueue.length >= this.maxToasts) {
      this.removeToast(this.toastQueue[0]);
    }

    container.appendChild(toast);
    this.toastQueue.push(toast);

    // Auto remove after duration
    setTimeout(() => {
      this.removeToast(toast);
    }, duration);
  }

  createToastElement(message, type) {
    const toast = document.createElement("div");
    toast.className = `toast px-4 py-3 rounded-lg shadow-lg text-white text-sm flex items-center gap-2 ${this.getToastColorClass(
      type
    )}`;

    const icon = document.createElement("i");
    icon.className = this.getToastIconClass(type);

    const text = document.createElement("span");
    text.textContent = message;

    const closeButton = document.createElement("button");
    closeButton.className = "ml-2 text-white hover:text-gray-200";
    closeButton.innerHTML = '<i class="fas fa-times text-xs"></i>';
    closeButton.onclick = () => this.removeToast(toast);

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeButton);

    return toast;
  }

  getToastColorClass(type) {
    const colors = {
      success: "bg-green-500",
      error: "bg-red-500",
      warning: "bg-yellow-500",
      info: "bg-blue-500",
    };
    return colors[type] || colors.info;
  }

  getToastIconClass(type) {
    const icons = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      warning: "fas fa-exclamation-triangle",
      info: "fas fa-info-circle",
    };
    return icons[type] || icons.info;
  }

  removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    toast.classList.add("removing");

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }

      // Remove from queue
      const index = this.toastQueue.indexOf(toast);
      if (index > -1) {
        this.toastQueue.splice(index, 1);
      }
    }, 300);
  }

  initializeToastContainer() {
    const container = document.getElementById("toastContainer");
    if (!container) {
      console.error("Toast container not found");
    }
  }

  // Utility methods
  enableElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.disabled = false;
    }
  }

  disableElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.disabled = true;
    }
  }

  showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.remove("hidden");
    }
  }

  hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.add("hidden");
    }
  }

  scrollToBottom() {
    const container = document.getElementById("messagesContainer");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  showError(message) {
    this.showToast(message, "error");
  }

  showSuccess(message) {
    this.showToast(message, "success");
  }

  showInfo(message) {
    this.showToast(message, "info");
  }

  showWarning(message) {
    this.showToast(message, "warning");
  }

  showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
      element.disabled = true;
    }
  }

  hideLoading(elementId, originalText) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = originalText;
      element.disabled = false;
    }
  }

  // Responsive design handling
  updateLayoutForMobile() {
    const isMobile = window.innerWidth < 1024;
    const sidebar = document.getElementById("sidebar");

    if (isMobile) {
      sidebar.classList.add("hidden");
    } else {
      // Show sidebar on desktop if user is logged in
      if (
        document.getElementById("chatScreen").classList.contains("hidden") ===
        false
      ) {
        sidebar.classList.remove("hidden");
      }
    }
  }

  initResponsiveHandlers() {
    window.addEventListener("resize", () => {
      this.updateLayoutForMobile();
    });

    // Initial check
    this.updateLayoutForMobile();
  }

  // Connection status
  showConnectionStatus(isConnected) {
    // Remove existing status if any
    const existingStatus = document.getElementById("connectionStatus");
    if (existingStatus) {
      existingStatus.remove();
    }

    const status = document.createElement("div");
    status.id = "connectionStatus";
    status.className = `connection-status px-3 py-1 rounded-full text-white text-xs font-medium ${
      isConnected ? "connected" : "disconnected"
    }`;
    status.textContent = isConnected ? "Connected" : "Disconnected";

    document.body.appendChild(status);

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (status.parentNode) {
        status.remove();
      }
    }, 3000);
  }

  // Typing indicator (for future use)
  showTypingIndicator(username) {
    const container = document.getElementById("messagesContainer");
    const existingIndicator = document.getElementById("typingIndicator");

    if (existingIndicator) {
      existingIndicator.remove();
    }

    const indicator = document.createElement("div");
    indicator.id = "typingIndicator";
    indicator.className = "typing-indicator";
    indicator.innerHTML = `
            <div class="user-avatar">
                <span>${username.substring(0, 2).toUpperCase()}</span>
            </div>
            <div class="text-gray-500 dark:text-gray-400 text-sm">
                ${username} is typing
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
  }

  hideTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    if (indicator) {
      indicator.remove();
    }
  }
}

// Initialize responsive handlers when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  if (window.ui) {
    window.ui.initResponsiveHandlers();
  }
});
