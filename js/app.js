// Main application controller for room-based chat
class DecentralChat {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
    this.gun = null;
    this.chatRef = null;

    this.init();
  }

  async init() {
    try {
      // Initialize GUN.js
      this.gun = GUN(["https://gun-manhattan.herokuapp.com/gun"]);
      this.chatRef = this.gun.get("decentralchat-rooms");

      // Initialize modules
      this.auth = new Auth(this.gun);
      this.chat = new Chat(this.gun, this.chatRef);
      this.ui = new UI();

      // Set up event listeners
      this.setupEventListeners();

      // Check for existing wallet connection
      await this.checkExistingConnection();

      this.isInitialized = true;
      console.log("NusaWhisper initialized successfully");
    } catch (error) {
      console.error("Failed to initialize NusaWhisper:", error);
      this.ui.showToast("Failed to initialize app", "error");
    }
  }

  setupEventListeners() {
    // Authentication events
    document.getElementById("connectWallet").addEventListener("click", () => {
      this.handleWalletConnect();
    });

    document
      .getElementById("disconnectWallet")
      .addEventListener("click", () => {
        this.handleWalletDisconnect();
      });

    // Chat events
    document.getElementById("sendButton").addEventListener("click", () => {
      this.handleSendMessage();
    });

    document
      .getElementById("messageInput")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.handleSendMessage();
        }
      });

    document.getElementById("messageInput").addEventListener("input", (e) => {
      const sendButton = document.getElementById("sendButton");
      sendButton.disabled = !e.target.value.trim();
    });

    // UI events
    document.getElementById("themeToggle").addEventListener("click", () => {
      this.ui.toggleTheme();
    });

    // User settings
    document.getElementById("userSettingsBtn").addEventListener("click", () => {
      this.ui.showUserModal();
    });

    document.getElementById("mobileUserBtn").addEventListener("click", () => {
      this.ui.showUserModal();
    });

    document.getElementById("closeModal").addEventListener("click", () => {
      this.ui.hideUserModal();
    });

    document.getElementById("saveNickname").addEventListener("click", () => {
      this.handleSaveNickname();
    });

    document.getElementById("copyAddress").addEventListener("click", () => {
      this.handleCopyAddress();
    });

    document
      .getElementById("toggleOnlineStatus")
      .addEventListener("click", () => {
        this.handleToggleOnlineStatus();
      });

    // Room management
    document.getElementById("createRoomBtn").addEventListener("click", () => {
      this.ui.showCreateRoomModal();
    });

    document
      .getElementById("createRoomBtnMobile")
      .addEventListener("click", () => {
        this.ui.showCreateRoomModal();
      });

    document
      .getElementById("createRoomConfirm")
      .addEventListener("click", () => {
        this.handleCreateRoom();
      });

    document
      .getElementById("cancelCreateRoom")
      .addEventListener("click", () => {
        this.ui.hideCreateRoomModal();
      });

    document.getElementById("joinInviteBtn").addEventListener("click", () => {
      this.ui.showJoinInviteModal();
    });

    document
      .getElementById("joinInviteBtnMobile")
      .addEventListener("click", () => {
        this.ui.showJoinInviteModal();
      });

    document
      .getElementById("joinByInviteConfirm")
      .addEventListener("click", () => {
        this.handleJoinByInvite();
      });

    document
      .getElementById("cancelJoinInvite")
      .addEventListener("click", () => {
        this.ui.hideJoinInviteModal();
      });

    // Room options
    document.getElementById("roomOptionsBtn").addEventListener("click", () => {
      this.ui.showRoomOptionsModal();
    });

    document
      .getElementById("generateInviteBtn")
      .addEventListener("click", () => {
        this.handleGenerateInvite();
      });

    document.getElementById("clearChatBtn").addEventListener("click", () => {
      this.handleClearChat();
    });

    document.getElementById("leaveRoomBtn").addEventListener("click", () => {
      this.handleLeaveRoom();
    });

    document
      .getElementById("closeRoomOptionsModal")
      .addEventListener("click", () => {
        this.ui.hideRoomOptionsModal();
      });

    // Direct chat
    document.getElementById("directChatBtn").addEventListener("click", () => {
      this.ui.showDirectChatModal();
    });

    document.getElementById("startDirectChat").addEventListener("click", () => {
      this.handleStartDirectChat();
    });

    document
      .getElementById("startDirectChatBtn")
      .addEventListener("click", () => {
        this.handleStartDirectChatFromUserInfo();
      });

    document
      .getElementById("cancelDirectChat")
      .addEventListener("click", () => {
        this.ui.hideDirectChatModal();
      });

    // User info modal
    document
      .getElementById("closeUserInfoModal")
      .addEventListener("click", () => {
        this.ui.hideUserInfoModal();
      });

    // Mobile sidebar
    document.getElementById("mobileMenuBtn").addEventListener("click", () => {
      this.ui.showMobileSidebar();
    });

    document
      .getElementById("closeMobileSidebar")
      .addEventListener("click", () => {
        this.ui.hideMobileSidebar();
      });

    document
      .getElementById("mobileSidebarOverlay")
      .addEventListener("click", (e) => {
        if (e.target.id === "mobileSidebarOverlay") {
          this.ui.hideMobileSidebar();
        }
      });

    // Close modals on outside click
    document.getElementById("userModal").addEventListener("click", (e) => {
      if (e.target.id === "userModal") {
        this.ui.hideUserModal();
      }
    });

    document
      .getElementById("directChatModal")
      .addEventListener("click", (e) => {
        if (e.target.id === "directChatModal") {
          this.ui.hideDirectChatModal();
        }
      });

    document.getElementById("userInfoModal").addEventListener("click", (e) => {
      if (e.target.id === "userInfoModal") {
        this.ui.hideUserInfoModal();
      }
    });

    document
      .getElementById("roomOptionsModal")
      .addEventListener("click", (e) => {
        if (e.target.id === "roomOptionsModal") {
          this.ui.hideRoomOptionsModal();
        }
      });

    // Handle wallet account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
          this.handleWalletDisconnect();
        } else {
          this.handleAccountChange(accounts[0]);
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }
  }

  async checkExistingConnection() {
    try {
      const user = await this.auth.checkConnection();
      if (user) {
        this.currentUser = user;
        this.ui.showChatScreen();
        this.ui.updateUserAddress(user.address);
        await this.chat.initialize(user);

        // Load and display current nickname
        const nickname = await this.auth.getUserNickname(user.address);
        document.getElementById("nicknameInput").value =
          nickname === user.shortAddress ? "" : nickname;

        // Update sidebar user info
        this.ui.updateSidebarUserInfo(user, nickname);

        this.ui.showToast("Welcome back!", "success");
      }
    } catch (error) {
      console.error("Error checking existing connection:", error);
    }
  }

  async handleWalletConnect() {
    try {
      this.ui.showAuthLoading();
      const user = await this.auth.connectWallet();

      if (user) {
        this.currentUser = user;
        this.ui.showChatScreen();
        this.ui.updateUserAddress(user.address);
        await this.chat.initialize(user);

        // Load and display current nickname
        const nickname = await this.auth.getUserNickname(user.address);
        document.getElementById("nicknameInput").value =
          nickname === user.shortAddress ? "" : nickname;

        // Update sidebar user info
        this.ui.updateSidebarUserInfo(user, nickname);

        this.ui.showToast("Connected successfully!", "success");
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
      this.ui.showAuthError(error.message);
    } finally {
      this.ui.hideAuthLoading();
    }
  }

  async handleWalletDisconnect() {
    try {
      await this.auth.disconnect();
      this.currentUser = null;
      this.chat.cleanup();
      this.ui.showAuthScreen();
      this.ui.showToast("Disconnected successfully", "info");
    } catch (error) {
      console.error("Disconnect failed:", error);
      this.ui.showToast("Disconnect failed", "error");
    }
  }

  async handleAccountChange(newAccount) {
    if (
      this.currentUser &&
      this.currentUser.address.toLowerCase() !== newAccount.toLowerCase()
    ) {
      this.ui.showToast("Account changed, reconnecting...", "info");
      await this.handleWalletDisconnect();
      // Auto-reconnect with new account
      setTimeout(() => {
        this.handleWalletConnect();
      }, 1000);
    }
  }

  async handleSendMessage() {
    const messageInput = document.getElementById("messageInput");
    const message = messageInput.value.trim();

    if (!message || !this.currentUser) return;

    try {
      await this.chat.sendMessage(message, this.currentUser);
      messageInput.value = "";
      document.getElementById("sendButton").disabled = true;
    } catch (error) {
      console.error("Failed to send message:", error);
      this.ui.showToast("Failed to send message", "error");
    }
  }

  handleCopyAddress() {
    if (this.currentUser) {
      Utils.copyToClipboard(this.currentUser.address);
      this.ui.showToast("Address copied to clipboard!", "success");
    }
  }

  async handleSaveNickname() {
    try {
      const nicknameInput = document.getElementById("nicknameInput");
      const nickname = nicknameInput.value.trim();

      if (!nickname) {
        this.ui.showToast("Please enter a nickname", "warning");
        return;
      }

      const success = await this.auth.setUserNickname(
        this.currentUser.address,
        nickname
      );
      if (success) {
        this.ui.showToast("Nickname saved successfully!", "success");
        this.ui.hideUserModal();

        // Update sidebar user info
        this.ui.updateSidebarUserInfo(this.currentUser, nickname);

        // Update user info in current room
        if (this.chat.currentChatType === "room") {
          await this.chat.addUserToRoom(this.chat.currentRoom);
        }
      } else {
        this.ui.showToast("Failed to save nickname", "error");
      }
    } catch (error) {
      console.error("Failed to save nickname:", error);
      this.ui.showToast("Failed to save nickname", "error");
    }
  }

  async handleToggleOnlineStatus() {
    try {
      const isOnline = await this.chat.toggleOnlineStatus();
      this.ui.updateOnlineStatusDisplay(isOnline);
      this.ui.showToast(
        `Status set to ${isOnline ? "online" : "offline"}`,
        "info"
      );
    } catch (error) {
      console.error("Failed to toggle online status:", error);
      this.ui.showToast("Failed to update status", "error");
    }
  }

  async handleCreateRoom() {
    try {
      const roomNameInput = document.getElementById("roomNameInput");
      const privateCheckbox = document.getElementById("privateRoomCheckbox");

      const roomName = roomNameInput.value.trim();
      const isPrivate = privateCheckbox.checked;

      if (!roomName) {
        this.ui.showToast("Please enter a room name", "warning");
        return;
      }

      const roomId = await this.chat.createRoom(roomName, isPrivate);
      this.ui.hideCreateRoomModal();
      this.ui.updateRoomList(this.chat.userRooms);
      this.ui.showToast(`Room "${roomName}" created successfully!`, "success");

      // Clear form
      roomNameInput.value = "";
      privateCheckbox.checked = false;
    } catch (error) {
      console.error("Failed to create room:", error);
      this.ui.showToast(error.message || "Failed to create room", "error");
    }
  }

  async handleJoinByInvite() {
    try {
      const inviteCodeInput = document.getElementById("inviteCodeInput");
      const inviteCode = inviteCodeInput.value.trim();

      if (!inviteCode) {
        this.ui.showToast("Please enter an invite code", "warning");
        return;
      }

      const roomName = await this.chat.joinByInvite(inviteCode);
      this.ui.hideJoinInviteModal();
      this.ui.updateRoomList(this.chat.userRooms);
      this.ui.showToast(`Joined room successfully!`, "success");

      // Clear form
      inviteCodeInput.value = "";
    } catch (error) {
      console.error("Failed to join by invite:", error);
      this.ui.showToast(error.message || "Failed to join room", "error");
    }
  }

  async handleGenerateInvite() {
    try {
      const inviteCode = await this.chat.generateRoomInvite(
        this.chat.currentRoom
      );
      this.ui.hideRoomOptionsModal();

      // Copy to clipboard and show
      Utils.copyToClipboard(inviteCode);
      this.ui.showToast(`Invite code copied: ${inviteCode}`, "success", 5000);
    } catch (error) {
      console.error("Failed to generate invite:", error);
      this.ui.showToast("Failed to generate invite", "error");
    }
  }

  async handleClearChat() {
    try {
      const confirmed = confirm(
        "Are you sure you want to clear all messages in this room? This action cannot be undone."
      );
      if (!confirmed) return;

      await this.chat.clearChat();
      this.ui.hideRoomOptionsModal();
      this.ui.showToast("Chat cleared successfully", "success");
    } catch (error) {
      console.error("Failed to clear chat:", error);
      this.ui.showToast(error.message || "Failed to clear chat", "error");
    }
  }

  async handleLeaveRoom() {
    try {
      if (this.chat.currentRoom === "general") {
        this.ui.showToast("Cannot leave the general room", "warning");
        return;
      }

      const confirmed = confirm(
        `Are you sure you want to leave the "${this.chat.currentRoom}" room?`
      );
      if (!confirmed) return;

      await this.chat.leaveRoom(this.chat.currentRoom);
      this.ui.hideRoomOptionsModal();
      this.ui.updateRoomList(this.chat.userRooms);
      this.ui.showToast("Left room successfully", "success");
    } catch (error) {
      console.error("Failed to leave room:", error);
      this.ui.showToast(error.message || "Failed to leave room", "error");
    }
  }

  async handleStartDirectChat() {
    try {
      const addressInput = document.getElementById("directChatAddress");
      const address = addressInput.value.trim();

      if (!address) {
        this.ui.showToast("Please enter a wallet address", "warning");
        return;
      }

      if (!Utils.isValidEthereumAddress(address)) {
        this.ui.showToast("Invalid wallet address", "error");
        return;
      }

      if (address.toLowerCase() === this.currentUser.address.toLowerCase()) {
        this.ui.showToast("Cannot start chat with yourself", "warning");
        return;
      }

      await this.chat.startDirectChat(address);
      this.ui.hideDirectChatModal();
      this.ui.showToast("Direct chat started", "success");

      // Clear input
      addressInput.value = "";
    } catch (error) {
      console.error("Failed to start direct chat:", error);
      this.ui.showToast(
        error.message || "Failed to start direct chat",
        "error"
      );
    }
  }

  async handleStartDirectChatFromUserInfo() {
    try {
      const userAddress = this.ui.currentUserInfoAddress;
      if (!userAddress) return;

      await this.chat.startDirectChat(userAddress);
      this.ui.hideUserInfoModal();
      this.ui.showToast("Direct chat started", "success");
    } catch (error) {
      console.error("Failed to start direct chat:", error);
      this.ui.showToast(
        error.message || "Failed to start direct chat",
        "error"
      );
    }
  }

  // Room switching handler
  async handleRoomSwitch(roomId) {
    try {
      await this.chat.joinRoom(roomId);
      this.ui.updateRoomList(this.chat.userRooms, roomId);
      this.ui.showToast(`Switched to ${roomId} room`, "info");
    } catch (error) {
      console.error("Failed to switch room:", error);
      this.ui.showToast("Failed to switch room", "error");
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.app = new DecentralChat();
});

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
  if (window.app && window.app.chat) {
    if (document.hidden) {
      window.app.chat.setOnlineStatus(false);
    } else {
      window.app.chat.setOnlineStatus(window.app.chat.isOnlineVisible);
    }
  }
});

// Handle before unload
window.addEventListener("beforeunload", () => {
  if (window.app && window.app.chat) {
    window.app.chat.setOnlineStatus(false);
  }
});

// Export for global access
window.DecentralChat = DecentralChat;