// Chat functionality using GUN.js
class Chat {
  constructor(gun, chatRef) {
    this.gun = gun;
    this.chatRef = chatRef;
    this.messagesRef = null;
    this.usersRef = null;
    this.currentUser = null;
    this.messageListeners = [];
    this.userListeners = [];
    this.onlineUsers = new Map(); // Changed to Map to store user info
    this.lastMessageTime = 0;
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.receivedMessages = new Set();
    this.currentChatType = "room"; // 'room' or 'direct'
    this.currentRoom = "general";
    this.directChatPartner = null;
    this.directMessagesRef = null;
    this.roomsRef = null;
    this.currentRoomRef = null;
    this.isOnlineVisible = true;
    this.userRooms = new Set(["general"]); // Rooms user has joined
  }

  async initialize(user) {
    try {
      this.currentUser = user;

      // Set up GUN references for rooms
      this.roomsRef = this.gun.get("chatrooms");
      this.usersRef = this.gun.get("allusers");

      // Join default room
      await this.joinRoom("general");

      // Set up user presence
      await this.setOnlineStatus(this.isOnlineVisible);

      // Set up periodic cleanup
      this.setupCleanup();

      console.log("Chat initialized for user:", user.shortAddress);
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      throw error;
    }
  }

  // Room management
  async joinRoom(roomName) {
    try {
      this.currentRoom = roomName;
      this.currentChatType = "room";
      this.userRooms.add(roomName);

      // Set up room references
      this.currentRoomRef = this.roomsRef.get(roomName);
      this.messagesRef = this.currentRoomRef.get("messages");

      // Setup message listener for this room
      this.setupRoomMessageListener();

      // Add user to room
      await this.addUserToRoom(roomName);

      // Load room messages
      await this.loadRoomMessages();

      // Update UI
      this.updateChatHeader();
    } catch (error) {
      console.error("Failed to join room:", error);
      throw error;
    }
  }

  async createRoom(roomName, isPrivate = false) {
    try {
      if (!roomName || roomName.trim().length === 0) {
        throw new Error("Room name cannot be empty");
      }

      const roomId = roomName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const roomData = {
        name: roomName,
        id: roomId,
        creator: this.currentUser.address,
        created: Date.now(),
        isPrivate: isPrivate,
        members: [this.currentUser.address],
      };

      // Store room info
      await new Promise((resolve, reject) => {
        this.roomsRef
          .get(roomId)
          .get("info")
          .put(roomData, (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
      });

      // Join the new room
      await this.joinRoom(roomId);

      return roomId;
    } catch (error) {
      console.error("Failed to create room:", error);
      throw error;
    }
  }

  async leaveRoom(roomName) {
    try {
      if (roomName === "general") {
        throw new Error("Cannot leave the general room");
      }

      // Remove user from room
      const roomUsersRef = this.roomsRef.get(roomName).get("users");
      roomUsersRef.get(this.currentUser.address).put(null);

      // Remove from user's room list
      this.userRooms.delete(roomName);

      // Switch to general room
      await this.joinRoom("general");
    } catch (error) {
      console.error("Failed to leave room:", error);
      throw error;
    }
  }

  async addUserToRoom(roomName) {
    const userInfo = {
      address: this.currentUser.address,
      nickname: await this.getUserNickname(),
      joinedAt: Date.now(),
      isOnline: this.isOnlineVisible,
    };

    const roomUsersRef = this.roomsRef.get(roomName).get("users");
    roomUsersRef.get(this.currentUser.address).put(userInfo);
  }

  setupRoomMessageListener() {
    if (this.messagesRef) {
      this.messagesRef.map().on((data, key) => {
        if (
          data &&
          key &&
          !key.startsWith("~") &&
          this.currentChatType === "room"
        ) {
          this.handleNewMessage(data, key);
        }
      });
    }

    // Listen for user presence in current room
    if (this.currentRoomRef) {
      this.currentRoomRef
        .get("users")
        .map()
        .on((data, key) => {
          if (data && key && !key.startsWith("~")) {
            this.handleRoomUserPresence(data, key);
          }
        });
    }
  }

  // Setup listener for direct messages
  setupDirectMessageListener() {
    if (this.directMessagesRef) {
      this.directMessagesRef.map().on((data, key) => {
        if (
          data &&
          key &&
          !key.startsWith("~") &&
          this.currentChatType === "direct"
        ) {
          this.handleNewMessage(data, key);
        }
      });
    }
  }

  async sendMessage(messageText, user) {
    try {
      if (!messageText.trim() || !user) {
        throw new Error("Invalid message or user");
      }

      // Rate limiting
      const now = Date.now();
      if (now - this.lastMessageTime < 1000) {
        throw new Error("Please wait a moment before sending another message");
      }

      // Get user nickname
      const auth = new Auth(this.gun);
      const nickname = await auth.getUserNickname(user.address);

      // Create message object
      const message = {
        id: Utils.generateId(),
        text: messageText.trim(),
        sender: user.address,
        senderShort: user.shortAddress,
        senderNickname: nickname,
        timestamp: now,
        signature: null,
        chatType: this.currentChatType,
        recipient: this.directChatPartner,
      };

      // Try to sign the message automatically
      try {
        const signedData = await auth.signChatMessage(
          messageText,
          user.address
        );
        message.signature = signedData.signature;
        message.signedData = signedData.signedData;
      } catch (signError) {
        console.warn("Message signing failed:", signError);
        // Continue without signature
      }

      // Add to queue for processing
      this.messageQueue.push(message);
      this.processMessageQueue();

      this.lastMessageTime = now;
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  }

  async processMessageQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();

        // Store in GUN
        await this.storeMessage(message);

        // Add to UI immediately for sender
        this.addMessageToUI(message, true);

        // Small delay to prevent overwhelming the network
        await Utils.sleep(100);
      }
    } catch (error) {
      console.error("Error processing message queue:", error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async storeMessage(message) {
    try {
      // Store with timestamp as key for ordering
      const messageKey = `msg_${message.timestamp}_${message.id}`;

      // Choose the appropriate reference based on chat type
      let targetRef;
      if (this.currentChatType === "direct") {
        targetRef = this.directMessagesRef;
      } else {
        targetRef = this.messagesRef; // Room messages
      }

      await new Promise((resolve, reject) => {
        targetRef.get(messageKey).put(message, (ack) => {
          if (ack.err) {
            reject(new Error(ack.err));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error("Failed to store message:", error);
      throw error;
    }
  }

  handleNewMessage(data, key) {
    try {
      // Validate message
      if (!this.isValidMessage(data)) {
        return;
      }

      // Check for duplicate messages
      const messageId = `${data.sender}_${data.timestamp}_${data.text}`;
      if (this.receivedMessages.has(messageId)) {
        return;
      }
      this.receivedMessages.add(messageId);

      // Don't add own messages again
      if (data.sender === this.currentUser?.address) {
        return;
      }

      // Add to UI
      this.addMessageToUI(data, false);
    } catch (error) {
      console.error("Error handling new message:", error);
    }
  }

  addMessageToUI(message, isOwn) {
    try {
      const messagesContainer = document.getElementById("messagesContainer");
      const messageElement = this.createMessageElement(message, isOwn);

      messagesContainer.appendChild(messageElement);

      // Auto-scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Play notification sound for received messages
      if (!isOwn) {
        this.playNotificationSound();
      }
    } catch (error) {
      console.error("Error adding message to UI:", error);
    }
  }

  createMessageElement(message, isOwn) {
    const messageContainer = document.createElement("div");
    messageContainer.className = `message-container ${isOwn ? "own" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "user-avatar";
    avatar.textContent = this.getAvatarText(message.sender);

    const messageContent = document.createElement("div");
    messageContent.className = "flex flex-col max-w-xs lg:max-w-md";

    const messageBubble = document.createElement("div");
    messageBubble.className = `message-bubble p-3 ${
      isOwn ? "message-own text-white" : "message-other text-gray-700"
    }`;

    const messageText = document.createElement("div");
    messageText.className = "break-words";
    messageText.textContent = message.text;

    const messageInfo = document.createElement("div");
    messageInfo.className = `message-timestamp flex items-center gap-2 mt-1 ${
      isOwn ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
    }`;

    const timestamp = document.createElement("span");
    timestamp.textContent = Utils.formatTime(message.timestamp);

    const senderInfo = document.createElement("span");
    // Use nickname if available, otherwise use short address
    const senderName = message.senderNickname || message.senderShort;
    senderInfo.textContent = senderName;

    messageInfo.appendChild(timestamp);
    if (!isOwn) {
      messageInfo.appendChild(senderInfo);
    }

    // Add signature indicator (automatic signing)
    if (message.signature) {
      const signatureIcon = document.createElement("i");
      signatureIcon.className = "fas fa-check-circle text-xs opacity-75";
      signatureIcon.title = "Message verified";
      messageInfo.appendChild(signatureIcon);
    }

    messageBubble.appendChild(messageText);
    messageContent.appendChild(messageBubble);
    messageContent.appendChild(messageInfo);

    if (!isOwn) {
      messageContainer.appendChild(avatar);
    }
    messageContainer.appendChild(messageContent);
    if (isOwn) {
      messageContainer.appendChild(avatar);
    }

    return messageContainer;
  }

  async loadRoomMessages() {
    try {
      const messages = [];

      // Load last 50 messages from current room
      await new Promise((resolve) => {
        this.messagesRef.map().once((data, key) => {
          if (data && key && !key.startsWith("~")) {
            messages.push({ ...data, key });
          }
        });

        // Wait a bit for messages to load
        setTimeout(resolve, 1000);
      });

      // Sort by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);

      // Take last 50 messages
      const recentMessages = messages.slice(-50);

      // Clear existing messages
      const messagesContainer = document.getElementById("messagesContainer");
      messagesContainer.innerHTML = "";

      // Add messages to UI
      recentMessages.forEach((message) => {
        const isOwn = message.sender === this.currentUser?.address;
        this.addMessageToUI(message, isOwn);
      });
    } catch (error) {
      console.error("Failed to load room messages:", error);
    }
  }

  async clearChat() {
    try {
      // Clear messages from current room (only for room creator or admin)
      if (this.currentChatType === "room") {
        // Check if user has permission
        const roomInfo = await this.getRoomInfo(this.currentRoom);
        if (roomInfo && roomInfo.creator === this.currentUser.address) {
          // Clear messages
          this.messagesRef.map().once((data, key) => {
            if (data && key && !key.startsWith("~")) {
              this.messagesRef.get(key).put(null);
            }
          });

          // Clear UI
          const messagesContainer =
            document.getElementById("messagesContainer");
          messagesContainer.innerHTML = "";

          return true;
        } else {
          throw new Error("Only room creator can clear chat");
        }
      } else if (this.currentChatType === "direct") {
        // Clear direct messages
        this.directMessagesRef.map().once((data, key) => {
          if (data && key && !key.startsWith("~")) {
            this.directMessagesRef.get(key).put(null);
          }
        });

        // Clear UI
        const messagesContainer = document.getElementById("messagesContainer");
        messagesContainer.innerHTML = "";

        return true;
      }
    } catch (error) {
      console.error("Failed to clear chat:", error);
      throw error;
    }
  }

  async getRoomInfo(roomName) {
    try {
      return new Promise((resolve) => {
        this.roomsRef
          .get(roomName)
          .get("info")
          .once((data) => {
            resolve(data);
          });
      });
    } catch (error) {
      console.error("Failed to get room info:", error);
      return null;
    }
  }

  async getUserNickname() {
    const auth = new Auth(this.gun);
    return await auth.getUserNickname(this.currentUser.address);
  }

  async toggleOnlineStatus() {
    this.isOnlineVisible = !this.isOnlineVisible;
    await this.setOnlineStatus(this.isOnlineVisible);

    // Update user info in current room
    if (this.currentChatType === "room") {
      await this.addUserToRoom(this.currentRoom);
    }

    return this.isOnlineVisible;
  }

  showUserInfo(userInfo) {
    // Trigger UI to show user info modal
    if (window.app && window.app.ui) {
      window.app.ui.showUserInfoModal(userInfo);
    }
  }

  async generateRoomInvite(roomName) {
    try {
      const inviteCode = Utils.generateSecureRandom(8);
      const inviteData = {
        roomName: roomName,
        createdBy: this.currentUser.address,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        used: false,
      };

      await new Promise((resolve, reject) => {
        this.gun
          .get("invites")
          .get(inviteCode)
          .put(inviteData, (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
      });

      return inviteCode;
    } catch (error) {
      console.error("Failed to generate room invite:", error);
      throw error;
    }
  }

  async joinByInvite(inviteCode) {
    try {
      const inviteData = await new Promise((resolve) => {
        this.gun
          .get("invites")
          .get(inviteCode)
          .once((data) => {
            resolve(data);
          });
      });

      if (!inviteData) {
        throw new Error("Invalid invite code");
      }

      if (inviteData.expiresAt < Date.now()) {
        throw new Error("Invite code has expired");
      }

      if (inviteData.used) {
        throw new Error("Invite code has already been used");
      }

      // Mark invite as used
      this.gun.get("invites").get(inviteCode).get("used").put(true);

      // Join the room
      await this.joinRoom(inviteData.roomName);

      return inviteData.roomName;
    } catch (error) {
      console.error("Failed to join by invite:", error);
      throw error;
    }
  }

  async setOnlineStatus(isOnline) {
    try {
      if (!this.currentUser) return;

      const userId = this.currentUser.address;
      const userStatus = {
        address: userId,
        shortAddress: this.currentUser.shortAddress,
        isOnline: isOnline,
        lastSeen: Date.now(),
      };

      if (isOnline) {
        this.usersRef.get(userId).put(userStatus);
      } else {
        this.usersRef.get(userId).put({ ...userStatus, isOnline: false });
      }
    } catch (error) {
      console.error("Failed to set online status:", error);
    }
  }

  handleRoomUserPresence(data, key) {
    try {
      if (!data || !key) return;

      if (data.isOnline && data.address) {
        this.onlineUsers.set(key, {
          address: data.address,
          nickname: data.nickname,
          joinedAt: data.joinedAt,
          isOnline: data.isOnline,
        });
      } else {
        this.onlineUsers.delete(key);
      }

      // Update online count
      const onlineCount = document.getElementById("onlineCount");
      if (onlineCount) {
        onlineCount.textContent = this.onlineUsers.size;
      }

      // Update user list in sidebar
      this.updateUserList();
    } catch (error) {
      console.error("Error handling room user presence:", error);
    }
  }

  updateUserList() {
    const userListContainer = document.getElementById("userList");
    if (!userListContainer) return;

    userListContainer.innerHTML = "";

    this.onlineUsers.forEach((userInfo, address) => {
      if (userInfo.isOnline) {
        const userElement = this.createUserElement(userInfo);
        userListContainer.appendChild(userElement);
      }
    });
  }

  createUserElement(userInfo) {
    const userDiv = document.createElement("div");
    userDiv.className =
      "flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer";
    userDiv.onclick = () => this.showUserInfo(userInfo);

    const avatar = document.createElement("div");
    avatar.className =
      "w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold";
    avatar.textContent = this.getAvatarText(userInfo.address);

    const userDetails = document.createElement("div");
    userDetails.className = "flex-1";

    const nickname = document.createElement("div");
    nickname.className = "text-sm font-medium text-gray-800 dark:text-white";
    nickname.textContent =
      userInfo.nickname || userInfo.address.substring(0, 8) + "...";

    const status = document.createElement("div");
    status.className = "text-xs text-green-500";
    status.textContent = "Online";

    userDetails.appendChild(nickname);
    userDetails.appendChild(status);

    userDiv.appendChild(avatar);
    userDiv.appendChild(userDetails);

    return userDiv;
  }

  getAvatarText(address) {
    if (!address) return "?";
    return address.substring(2, 4).toUpperCase();
  }

  isValidMessage(message) {
    return (
      message &&
      message.text &&
      message.sender &&
      message.timestamp &&
      typeof message.text === "string" &&
      message.text.trim().length > 0
    );
  }

  playNotificationSound() {
    try {
      // Create a simple notification beep
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.1
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      // Ignore audio errors
    }
  }

  setupCleanup() {
    // Clean up old messages periodically
    setInterval(() => {
      this.cleanupOldMessages();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async cleanupOldMessages() {
    try {
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

      this.messagesRef.map().once((data, key) => {
        if (data && data.timestamp < cutoffTime) {
          this.messagesRef.get(key).put(null);
        }
      });
    } catch (error) {
      console.error("Failed to cleanup old messages:", error);
    }
  }

  // Direct message functionality
  async startDirectChat(partnerAddress) {
    try {
      if (!Utils.isValidEthereumAddress(partnerAddress)) {
        throw new Error("Invalid wallet address");
      }

      this.currentChatType = "direct";
      this.directChatPartner = partnerAddress;

      // Create direct chat reference
      const chatId = this.generateDirectChatId(
        this.currentUser.address,
        partnerAddress
      );
      this.directMessagesRef = this.gun.get(`direct_${chatId}`);

      // Setup direct message listener
      this.setupDirectMessageListener();

      // Clear current messages
      const messagesContainer = document.getElementById("messagesContainer");
      messagesContainer.innerHTML = "";

      // Load direct messages
      await this.loadDirectMessages();

      // Update UI
      this.updateChatHeader(partnerAddress);

      return true;
    } catch (error) {
      console.error("Failed to start direct chat:", error);
      throw error;
    }
  }

  async switchToGlobalChat() {
    this.currentChatType = "global";
    this.directChatPartner = null;
    this.directMessagesRef = null;

    // Clear current messages
    const messagesContainer = document.getElementById("messagesContainer");
    messagesContainer.innerHTML = "";

    // Load global messages
    await this.loadRecentMessages();

    // Update UI
    this.updateChatHeader();
  }

  generateDirectChatId(address1, address2) {
    const addresses = [address1.toLowerCase(), address2.toLowerCase()].sort();
    return `${addresses[0]}_${addresses[1]}`;
  }

  async loadDirectMessages() {
    try {
      const messages = [];

      await new Promise((resolve) => {
        this.directMessagesRef.map().once((data, key) => {
          if (data && key && !key.startsWith("~")) {
            messages.push({ ...data, key });
          }
        });

        setTimeout(resolve, 1000);
      });

      // Sort by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);

      // Add messages to UI
      messages.forEach((message) => {
        const isOwn = message.sender === this.currentUser?.address;
        this.addMessageToUI(message, isOwn);
      });
    } catch (error) {
      console.error("Failed to load direct messages:", error);
    }
  }

  updateChatHeader(partnerAddress = null) {
    const chatTitle = document.querySelector("#chatScreen h3");
    const chatSubtitle = document.querySelector("#chatScreen p");

    if (partnerAddress) {
      const auth = new Auth(this.gun);
      auth.getUserNickname(partnerAddress).then((nickname) => {
        chatTitle.textContent = `Direct Chat`;
        chatSubtitle.innerHTML = `with ${nickname}`;
      });
    } else {
      chatTitle.textContent = "Global Chat";
      chatSubtitle.innerHTML = `<span id="onlineCount">${this.onlineUsers.size}</span> online`;
    }
  }

  cleanup() {
    try {
      // Set offline status
      this.setOnlineStatus(false);

      // Clear listeners
      this.messageListeners.forEach((listener) => {
        if (listener.off) listener.off();
      });

      this.userListeners.forEach((listener) => {
        if (listener.off) listener.off();
      });

      // Clear references
      this.messagesRef = null;
      this.usersRef = null;
      this.directMessagesRef = null;
      this.currentUser = null;
      this.onlineUsers.clear();
      this.messageQueue = [];
      this.receivedMessages.clear();
    } catch (error) {
      console.error("Failed to cleanup chat:", error);
    }
  }
}
