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
    this.currentRoom = null;
    this.directChatPartner = null;
    this.directMessagesRef = null;
    this.roomsRef = null;
    this.currentRoomRef = null;
    this.isOnlineVisible = true;
    this.userRooms = new Set(); // Rooms user has joined
    this.contacts = new Map(); // Store contacts for direct messages
    this.contactsRef = null;
  }

  async initialize(user) {
    try {
      this.currentUser = user;

      // Set up GUN references
      this.roomsRef = this.gun.get("chatrooms");
      this.usersRef = this.gun.get("allusers");
      this.contactsRef = this.gun.get("contacts").get(user.address);

      // Load user's contacts and rooms
      await this.loadUserContacts();
      await this.loadUserRooms();
      await this.loadUserInvitations();

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
      // Clean up previous room state
      this.cleanupListeners();
      this.receivedMessages.clear();

      this.currentRoom = roomName;
      this.currentChatType = "room";

      // Don't add welcome to user rooms
      if (roomName !== "welcome") {
        this.userRooms.add(roomName);
      }

      // Check if this is welcome screen
      if (roomName === "welcome") {
        this.showWelcomeScreen();
        return;
      }

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
      
      // Update room list in UI
      if (window.app && window.app.ui) {
        window.app.ui.updateRoomList(this.userRooms, roomName);
      }
    } catch (error) {
      console.error("Failed to join room:", error);
      throw error;
    }
  }

  showWelcomeScreen() {
    const messagesContainer = document.getElementById("messagesContainer");
    const chatTitle = document.getElementById("chatTitle");
    const onlineCount = document.getElementById("onlineCount");
    const userListContainer = document.getElementById("userList");
    const messageInput = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");

    // Set current room to welcome but don't add to list
    this.currentRoom = "welcome";
    this.currentChatType = "welcome";

    // Update header
    if (chatTitle) {
      chatTitle.textContent = "Welcome to NusaWhisper";
    }
    // Hide online count for welcome screen
    if (onlineCount) {
      onlineCount.style.display = "none";
    }
    if (userListContainer) {
      userListContainer.innerHTML = "";
    }

    // Disable message input and send button
    if (messageInput) {
      messageInput.disabled = true;
      messageInput.placeholder = "Select or create a room to start chatting...";
    }
    if (sendButton) {
      sendButton.disabled = true;
    }

    // Show welcome content
    messagesContainer.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div class="w-24 h-24 bg-gradient-to-br from-web3-cyan to-web3-purple rounded-full flex items-center justify-center mb-6">
          <i class="fas fa-comments text-white text-3xl"></i>
        </div>
        
        <h1 class="text-3xl font-bold text-slate-800 dark:text-white mb-4">
          Welcome to NusaWhisper
        </h1>
        
        <p class="text-slate-600 dark:text-slate-300 mb-8 max-w-md">
          A decentralized chat application powered by Web3 technology. Connect with others securely using your Ethereum wallet.
        </p>
        
        <div class="space-y-4 w-full max-w-sm">
          <div class="flex items-center space-x-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <div class="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <i class="fas fa-shield-alt text-white"></i>
            </div>
            <div class="text-left">
              <div class="font-medium text-slate-800 dark:text-white">Secure & Private</div>
              <div class="text-sm text-slate-600 dark:text-slate-400">End-to-end encrypted messages</div>
            </div>
          </div>
          
          <div class="flex items-center space-x-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
              <i class="fas fa-globe text-white"></i>
            </div>
            <div class="text-left">
              <div class="font-medium text-slate-800 dark:text-white">Decentralized</div>
              <div class="text-sm text-slate-600 dark:text-slate-400">No central server required</div>
            </div>
          </div>
          
          <div class="flex items-center space-x-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <div class="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
              <i class="fas fa-users text-white"></i>
            </div>
            <div class="text-left">
              <div class="font-medium text-slate-800 dark:text-white">Community Driven</div>
              <div class="text-sm text-slate-600 dark:text-slate-400">Create and join rooms</div>
            </div>
          </div>
        </div>
        
        <div class="mt-8 p-4 bg-gradient-to-r from-web3-purple/10 to-web3-pink/10 rounded-xl border border-web3-purple/20">
          <p class="text-sm text-slate-600 dark:text-slate-300">
            <i class="fas fa-lightbulb text-web3-purple mr-2"></i>
            Start by creating a new room or joining an existing one from the sidebar!
          </p>
        </div>
      </div>
    `;
  }

  // Member management functions
  async kickMember(roomId, memberAddress) {
    try {
      const userPermissions = await this.getUserPermissions(roomId);
      if (!userPermissions.kick) {
        throw new Error("You don't have permission to kick members");
      }

      // Remove member from room
      this.roomsRef.get(roomId).get("members").get(memberAddress).put(null);
      
      // Update member count
      const roomInfo = await this.getRoomInfo(roomId);
      const newCount = (roomInfo.memberCount || 1) - 1;
      this.roomsRef.get(roomId).get("info").get("memberCount").put(newCount);

      // Send system message
      await this.sendSystemMessage(roomId, `${Utils.shortenAddress(memberAddress)} was kicked from the room`);
      
      return true;
    } catch (error) {
      console.error("Failed to kick member:", error);
      throw error;
    }
  }

  async banMember(roomId, memberAddress) {
    try {
      const userPermissions = await this.getUserPermissions(roomId);
      if (!userPermissions.ban) {
        throw new Error("You don't have permission to ban members");
      }

      // Add to banned list
      const bannedRef = this.roomsRef.get(roomId).get("banned").get(memberAddress);
      await new Promise((resolve, reject) => {
        bannedRef.put({
          address: memberAddress,
          bannedAt: Date.now(),
          bannedBy: this.currentUser.address
        }, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      // Remove from members
      await this.kickMember(roomId, memberAddress);

      // Send system message
      await this.sendSystemMessage(roomId, `${Utils.shortenAddress(memberAddress)} was banned from the room`);
      
      return true;
    } catch (error) {
      console.error("Failed to ban member:", error);
      throw error;
    }
  }

  async promoteToModerator(roomId, memberAddress) {
    try {
      const userPermissions = await this.getUserPermissions(roomId);
      if (!userPermissions.moderate) {
        throw new Error("You don't have permission to promote members");
      }

      const memberRef = this.roomsRef.get(roomId).get("members").get(memberAddress);
      const memberData = await new Promise((resolve) => {
        memberRef.once((data) => resolve(data));
      });

      if (memberData) {
        memberData.role = "moderator";
        memberData.permissions = {
          kick: true,
          ban: false,
          invite: true,
          moderate: false,
          deleteMessages: true
        };

        await new Promise((resolve, reject) => {
          memberRef.put(memberData, (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
        });

        await this.sendSystemMessage(roomId, `${Utils.shortenAddress(memberAddress)} is now a moderator`);
        return true;
      }
    } catch (error) {
      console.error("Failed to promote member:", error);
      throw error;
    }
  }

  async getUserPermissions(roomId) {
    try {
      const memberData = await new Promise((resolve) => {
        this.roomsRef.get(roomId).get("members").get(this.currentUser.address).once((data) => {
          resolve(data);
        });
      });

      return memberData?.permissions || {
        kick: false,
        ban: false,
        invite: false,
        moderate: false,
        deleteMessages: false
      };
    } catch (error) {
      console.error("Failed to get user permissions:", error);
      return {
        kick: false,
        ban: false,
        invite: false,
        moderate: false,
        deleteMessages: false
      };
    }
  }

  async getRoomMembers(roomId) {
    try {
      const members = [];
      await new Promise((resolve) => {
        this.roomsRef.get(roomId).get("members").map().once((data, key) => {
          if (data && key && !key.startsWith("~")) {
            members.push({ ...data, address: key });
          }
        });
        setTimeout(resolve, 1000);
      });
      return members;
    } catch (error) {
      console.error("Failed to get room members:", error);
      return [];
    }
  }

  async sendSystemMessage(roomId, message) {
    try {
      const systemMessage = {
        id: Utils.generateId(),
        text: message,
        sender: "system",
        senderShort: "System",
        senderNickname: "System",
        timestamp: Date.now(),
        isSystem: true,
        chatType: "room"
      };

      const messageKey = `msg_${systemMessage.timestamp}_${systemMessage.id}`;
      const messagesRef = this.roomsRef.get(roomId).get("messages");
      
      await new Promise((resolve, reject) => {
        messagesRef.get(messageKey).put(systemMessage, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });
    } catch (error) {
      console.error("Failed to send system message:", error);
    }
  }

  async checkRoomSecurity(roomId) {
    try {
      // Check if user is banned
      const bannedData = await new Promise((resolve) => {
        this.roomsRef.get(roomId).get("banned").get(this.currentUser.address).once((data) => {
          resolve(data);
        });
      });

      if (bannedData) {
        throw new Error("You are banned from this room");
      }

      // Check room capacity
      const roomInfo = await this.getRoomInfo(roomId);
      if (roomInfo && roomInfo.memberCount >= roomInfo.maxMembers) {
        throw new Error("Room is full");
      }

      return true;
    } catch (error) {
      console.error("Room security check failed:", error);
      throw error;
    }
  }

  async createRoom(roomName, isPrivate = false) {
    try {
      if (!roomName || roomName.trim().length === 0) {
        throw new Error("Room name cannot be empty");
      }

      const roomId = roomName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 20);
      if (roomId.length < 2) {
        throw new Error(
          "Room name must contain at least 2 alphanumeric characters",
        );
      }

      // Check if room already exists
      const existingRoom = await this.getRoomInfo(roomId);
      if (existingRoom && existingRoom.name) {
        throw new Error("Room already exists");
      }

      // Store room info in a simpler structure to avoid GUN data issues
      const roomRef = this.roomsRef.get(roomId);
      const infoRef = roomRef.get("info");

      // Store each property separately to avoid GUN data structure issues
      await new Promise((resolve, reject) => {
        infoRef.get("name").put(roomName, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        infoRef.get("creator").put(this.currentUser.address, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        infoRef.get("created").put(Date.now(), (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        infoRef.get("isPrivate").put(isPrivate || false, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        infoRef.get("memberCount").put(1, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        infoRef.get("maxMembers").put(100, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      // Initialize moderation settings
      const moderationRef = roomRef.get("moderation");
      await new Promise((resolve, reject) => {
        moderationRef.get("enabled").put(true, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        moderationRef.get("autoKick").put(false, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        moderationRef.get("bannedWords").put([], (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      // Add creator to members with admin role
      const memberRef = roomRef.get("members").get(this.currentUser.address);
      const nickname = await this.getUserNickname();
      await new Promise((resolve, reject) => {
        memberRef.put(
          {
            address: this.currentUser.address,
            joinedAt: Date.now(),
            role: "admin",
            nickname: nickname,
            permissions: {
              kick: true,
              ban: true,
              invite: true,
              moderate: true,
              deleteMessages: true
            }
          },
          (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          },
        );
      });

      // Add room to user's room list
      this.userRooms.add(roomId);
      
      // Save to localStorage
      this.saveUserRooms();

      // Join the new room
      await this.joinRoom(roomId);

      // Update UI
      if (window.app && window.app.ui) {
        window.app.ui.updateRoomList(this.userRooms, roomId);
      }

      return roomId;
    } catch (error) {
      console.error("Failed to create room:", error);
      throw error;
    }
  }

  async leaveRoom(roomName) {
    try {
      if (roomName === "welcome") {
        throw new Error("Cannot leave the welcome screen");
      }

      // Remove user from room
      const roomUsersRef = this.roomsRef.get(roomName).get("users");
      roomUsersRef.get(this.currentUser.address).put(null);

      // Remove from user's room list
      this.userRooms.delete(roomName);

      // Save updated rooms
      this.saveUserRooms();

      // Switch to welcome screen
      this.showWelcomeScreen();
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

    // Enable message input when joining a room
    const messageInput = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");
    
    if (messageInput) {
      messageInput.disabled = false;
      messageInput.placeholder = "Type your message...";
    }
    if (sendButton) {
      sendButton.disabled = false;
    }
  }

  setupRoomMessageListener() {
    // Clean up previous listeners first
    this.cleanupListeners();

    if (this.messagesRef) {
      const messageListener = this.messagesRef.map().on((data, key) => {
        if (
          data &&
          key &&
          !key.startsWith("~") &&
          this.currentChatType === "room"
        ) {
          this.handleNewMessage(data, key);
        }
      });
      this.messageListeners.push(messageListener);
    }

    // Listen for user presence in current room
    if (this.currentRoomRef) {
      const userListener = this.currentRoomRef
        .get("users")
        .map()
        .on((data, key) => {
          if (data && key && !key.startsWith("~")) {
            this.handleRoomUserPresence(data, key);
          }
        });
      this.userListeners.push(userListener);
    }
  }

  // Setup listener for direct messages
  setupDirectMessageListener() {
    // Clean up previous listeners first
    this.cleanupListeners();

    if (this.directMessagesRef) {
      const directListener = this.directMessagesRef.map().on((data, key) => {
        if (
          data &&
          key &&
          !key.startsWith("~") &&
          this.currentChatType === "direct"
        ) {
          this.handleNewMessage(data, key);
        }
      });
      this.messageListeners.push(directListener);
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
          user.address,
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

        // Mark message as our own to prevent duplicate handling
        this.receivedMessages.add(message.id);

        // Store in GUN first
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

      // Check for duplicate messages using unique message ID
      const messageId =
        data.id || `${data.sender}_${data.timestamp}_${data.text}`;
      if (this.receivedMessages.has(messageId)) {
        return;
      }
      this.receivedMessages.add(messageId);

      // Don't add own messages again (they're already added when sending)
      if (data.sender === this.currentUser?.address) {
        return;
      }

      // For direct chat, check if message is for current conversation
      if (this.currentChatType === "direct" && data.chatType === "direct") {
        // Check if message is part of current direct chat
        const isRelevantMessage =
          (data.sender === this.directChatPartner &&
            data.recipient === this.currentUser.address) ||
          (data.sender === this.currentUser.address &&
            data.recipient === this.directChatPartner);

        if (!isRelevantMessage) {
          return;
        }
      }

      // For room chat, check if message is for current room
      if (this.currentChatType === "room" && data.chatType === "room") {
        // Message is already filtered by room through GUN reference
      }

      // Add to UI with proper delay to avoid race conditions
      setTimeout(() => {
        this.addMessageToUI(data, false);
      }, 50);
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
    messageBubble.className = `message-bubble ${isOwn ? "own" : "other"}`;

    const messageText = document.createElement("div");
    messageText.className = "break-words";
    messageText.textContent = message.text;

    const messageInfo = document.createElement("div");
    messageInfo.className = `message-timestamp flex items-center gap-2 mt-1 ${
      isOwn
        ? "text-gray-600 dark:text-blue-100"
        : "text-gray-600 dark:text-gray-400"
    }`;

    const timestamp = document.createElement("span");
    timestamp.textContent = Utils.formatTime(message.timestamp);

    const senderInfo = document.createElement("span");
    const senderName = message.senderNickname || message.senderShort;
    senderInfo.textContent = senderName;

    messageInfo.appendChild(timestamp);
    if (!isOwn) {
      messageInfo.appendChild(senderInfo);
    }

    if (message.signature) {
      const signatureIcon = document.createElement("i");
      signatureIcon.className = "fas fa-check-circle text-xs opacity-75";
      signatureIcon.title = "Message verified";
      messageInfo.appendChild(signatureIcon);
    }

    messageBubble.appendChild(messageText);
    messageContent.appendChild(messageBubble);
    messageContent.appendChild(messageInfo);

    // Struktur bubble + avatar
    if (isOwn) {
      // Untuk pesan sendiri, avatar di kanan
      messageContainer.appendChild(messageContent);
      messageContainer.appendChild(avatar);
    } else {
      // Untuk pesan orang lain, avatar di kiri
      messageContainer.appendChild(avatar);
      messageContainer.appendChild(messageContent);
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

      if (inviteData.used && inviteData.usedBy !== this.currentUser.address) {
        throw new Error("Invite code has already been used");
      }

      // Check room security before joining
      await this.checkRoomSecurity(inviteData.roomName);

      // Mark invite as used
      this.gun.get("invites").get(inviteCode).get("used").put(true);
      this.gun.get("invites").get(inviteCode).get("usedBy").put(this.currentUser.address);
      this.gun.get("invites").get(inviteCode).get("usedAt").put(Date.now());

      // Add user to room members
      const memberRef = this.roomsRef.get(inviteData.roomName).get("members").get(this.currentUser.address);
      const nickname = await this.getUserNickname();
      await new Promise((resolve, reject) => {
        memberRef.put({
          address: this.currentUser.address,
          joinedAt: Date.now(),
          role: "member",
          nickname: nickname,
          permissions: {
            kick: false,
            ban: false,
            invite: false,
            moderate: false,
            deleteMessages: false
          },
          invitedBy: inviteData.createdBy
        }, (ack) => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });

      // Update member count
      const roomInfo = await this.getRoomInfo(inviteData.roomName);
      const newCount = (roomInfo.memberCount || 0) + 1;
      this.roomsRef.get(inviteData.roomName).get("info").get("memberCount").put(newCount);

      // Add room to user's room list
      this.userRooms.add(inviteData.roomName);
      
      // Save to localStorage
      this.saveUserRooms();

      // Join the room
      await this.joinRoom(inviteData.roomName);

      // Update UI
      if (window.app && window.app.ui) {
        window.app.ui.updateRoomList(this.userRooms, inviteData.roomName);
      }

      // Send system message
      await this.sendSystemMessage(inviteData.roomName, `${nickname} joined the room`);

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
        audioContext.currentTime + 0.1,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      // Ignore audio errors
    }
  }

  setupCleanup() {
    // Clean up old messages periodically
    setInterval(
      () => {
        this.cleanupOldMessages();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes
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

      // Clean up previous state
      this.cleanupListeners();
      this.receivedMessages.clear();

      this.currentChatType = "direct";
      this.directChatPartner = partnerAddress;

      // Add as contact if not already added
      if (!this.hasContact(partnerAddress)) {
        await this.addContact(partnerAddress);
      }

      // Update last message time for contact
      const contact = this.contacts.get(partnerAddress);
      if (contact) {
        contact.lastMessageAt = Date.now();
        this.contacts.set(partnerAddress, contact);
        this.saveContactsToLocal();
      }

      // Create direct chat reference
      const chatId = this.generateDirectChatId(
        this.currentUser.address,
        partnerAddress,
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

      // Enable message input for direct chat
      const messageInput = document.getElementById("messageInput");
      const sendButton = document.getElementById("sendButton");
      
      if (messageInput) {
        messageInput.disabled = false;
        messageInput.placeholder = "Type your message...";
      }
      if (sendButton) {
        sendButton.disabled = false;
      }

      return true;
    } catch (error) {
      console.error("Failed to start direct chat:", error);
      throw error;
    }
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
    const chatTitle = document.getElementById("chatTitle");
    const onlineCount = document.getElementById("onlineCount");
    const userListContainer = document.getElementById("userList");

    if (partnerAddress) {
      const auth = new Auth(this.gun);
      auth.getUserNickname(partnerAddress).then((nickname) => {
        chatTitle.textContent = `Direct Chat with ${nickname}`;
      });

      // Show direct chat participants in user list
      if (userListContainer) {
        userListContainer.innerHTML = "";

        // Add current user
        const currentUserElement = this.createDirectChatUserElement({
          address: this.currentUser.address,
          nickname: this.currentUser.nickname,
          isOnline: true,
          isCurrentUser: true,
        });
        userListContainer.appendChild(currentUserElement);

        // Add chat partner
        auth.getUserNickname(partnerAddress).then((partnerNickname) => {
          const partnerElement = this.createDirectChatUserElement({
            address: partnerAddress,
            nickname: partnerNickname,
            isOnline: true,
            isCurrentUser: false,
          });
          userListContainer.appendChild(partnerElement);
        });
      }

      if (onlineCount) {
        onlineCount.style.display = "block";
        onlineCount.textContent = "2";
      }
    } else if (this.currentRoom !== "welcome") {
      chatTitle.textContent =
        this.currentRoom.charAt(0).toUpperCase() + this.currentRoom.slice(1);
      
      // Load and display room members
      this.loadRoomMembers();
      
      if (onlineCount) {
        onlineCount.style.display = "block";
        // Get actual member count from room info
        this.getRoomInfo(this.currentRoom).then((roomInfo) => {
          if (roomInfo && onlineCount) {
            onlineCount.textContent = roomInfo.memberCount || 0;
          }
        });
      }
    }
  }

  async loadRoomMembers() {
    try {
      const userListContainer = document.getElementById("userList");
      if (!userListContainer || this.currentRoom === "welcome") return;

      const members = await this.getRoomMembers(this.currentRoom);
      userListContainer.innerHTML = "";

      // Sort members by role and join date
      members.sort((a, b) => {
        const roleOrder = { admin: 0, moderator: 1, member: 2 };
        const aOrder = roleOrder[a.role] || 2;
        const bOrder = roleOrder[b.role] || 2;
        
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.joinedAt - b.joinedAt;
      });

      members.forEach(member => {
        const memberElement = this.createMemberElement(member);
        userListContainer.appendChild(memberElement);
      });
    } catch (error) {
      console.error("Failed to load room members:", error);
    }
  }

  createMemberElement(member) {
    const memberDiv = document.createElement("div");
    memberDiv.className = "flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer";
    
    // Add click handler for member options
    memberDiv.onclick = () => {
      if (member.address !== this.currentUser.address) {
        this.showMemberOptions(member);
      }
    };

    const avatar = document.createElement("div");
    avatar.className = "w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold relative";
    avatar.textContent = this.getAvatarText(member.address);

    // Add role indicator
    if (member.role === "admin") {
      const roleIcon = document.createElement("div");
      roleIcon.className = "absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center";
      roleIcon.innerHTML = '<i class="fas fa-crown text-white text-xs"></i>';
      roleIcon.title = "Admin";
      avatar.appendChild(roleIcon);
    } else if (member.role === "moderator") {
      const roleIcon = document.createElement("div");
      roleIcon.className = "absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center";
      roleIcon.innerHTML = '<i class="fas fa-shield-alt text-white text-xs"></i>';
      roleIcon.title = "Moderator";
      avatar.appendChild(roleIcon);
    }

    const memberDetails = document.createElement("div");
    memberDetails.className = "flex-1";

    const nickname = document.createElement("div");
    nickname.className = "text-sm font-medium text-gray-800 dark:text-white";
    nickname.textContent = member.nickname || Utils.shortenAddress(member.address);
    
    if (member.address === this.currentUser.address) {
      nickname.textContent += " (You)";
    }

    const memberInfo = document.createElement("div");
    memberInfo.className = "text-xs text-gray-500 dark:text-gray-400";
    memberInfo.textContent = member.role.charAt(0).toUpperCase() + member.role.slice(1);

    memberDetails.appendChild(nickname);
    memberDetails.appendChild(memberInfo);

    memberDiv.appendChild(avatar);
    memberDiv.appendChild(memberDetails);

    return memberDiv;
  }

  async showMemberOptions(member) {
    const userPermissions = await this.getUserPermissions(this.currentRoom);
    
    if (window.app && window.app.ui) {
      window.app.ui.showMemberOptionsModal(member, userPermissions);
    }
  }

  createDirectChatUserElement(userInfo) {
    const userDiv = document.createElement("div");
    userDiv.className =
      "flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg";

    const avatar = document.createElement("div");
    avatar.className =
      "w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold";
    avatar.textContent = this.getAvatarText(userInfo.address);

    const userDetails = document.createElement("div");
    userDetails.className = "flex-1";

    const nickname = document.createElement("div");
    nickname.className = "text-sm font-medium text-gray-800 dark:text-white";
    nickname.textContent =
      userInfo.nickname || Utils.shortenAddress(userInfo.address);

    if (userInfo.isCurrentUser) {
      nickname.textContent += " (You)";
    }

    const status = document.createElement("div");
    status.className = "text-xs text-green-500";
    status.textContent = userInfo.isOnline ? "Online" : "Offline";

    userDetails.appendChild(nickname);
    userDetails.appendChild(status);

    userDiv.appendChild(avatar);
    userDiv.appendChild(userDetails);

    return userDiv;
  }

  // Load user's contacts from storage
  async loadUserContacts() {
    try {
      // Load from localStorage first
      const storedContacts = Utils.getLocalStorage(
        `contacts_${this.currentUser.address}`,
        [],
      );
      storedContacts.forEach((contact) => {
        this.contacts.set(contact.address, contact);
      });

      // Listen for new contacts from GUN
      this.contactsRef.map().on((data, key) => {
        if (data && key && !key.startsWith("~")) {
          this.contacts.set(key, data);
          this.saveContactsToLocal();
        }
      });
    } catch (error) {
      console.error("Failed to load contacts:", error);
    }
  }

  // Load user's rooms
  async loadUserRooms() {
    try {
      const storedRooms = Utils.getLocalStorage(
        `rooms_${this.currentUser.address}`,
        [],
      );

      // Load stored rooms (don't include welcome in room list)
      storedRooms.forEach((roomId) => {
        this.userRooms.add(roomId);
      });

      // Also check for rooms where user is a member from GUN
      await this.loadRoomsFromGUN();

      // Update UI with loaded rooms
      if (window.app && window.app.ui) {
        // Show welcome first, but don't include it in room list
        window.app.ui.updateRoomList(this.userRooms, null);
      }

      // Start with welcome screen
      setTimeout(() => {
        this.showWelcomeScreen();
      }, 100);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  }

  // Load rooms from GUN where user is a member
  async loadRoomsFromGUN() {
    try {
      // Check all rooms where user is a member
      this.roomsRef.map().once((roomData, roomId) => {
        if (roomData && roomId && !roomId.startsWith("~")) {
          // Check if user is a member of this room
          if (roomData.members && roomData.members[this.currentUser.address]) {
            this.userRooms.add(roomId);
          }
        }
      });

      // Save updated rooms to localStorage after a delay to allow GUN to load
      setTimeout(() => {
        this.saveUserRooms();
      }, 2000);
    } catch (error) {
      console.error("Failed to load rooms from GUN:", error);
    }
  }

  // Save user rooms to localStorage
  saveUserRooms() {
    const roomsArray = Array.from(this.userRooms).filter(room => room !== "welcome");
    Utils.setLocalStorage(`rooms_${this.currentUser.address}`, roomsArray);
  }

  // Save contacts to localStorage
  saveContactsToLocal() {
    const contactsArray = Array.from(this.contacts.values());
    Utils.setLocalStorage(
      `contacts_${this.currentUser.address}`,
      contactsArray,
    );
  }

  // Add contact when starting direct chat
  async addContact(address, nickname = null) {
    try {
      if (address === this.currentUser.address) return;

      const contactData = {
        address: address,
        nickname: nickname || Utils.shortenAddress(address),
        addedAt: Date.now(),
        lastMessageAt: Date.now(),
      };

      this.contacts.set(address, contactData);
      this.contactsRef.get(address).put(contactData);
      this.saveContactsToLocal();

      // Update UI
      if (window.app && window.app.ui) {
        window.app.ui.updateContactsList(this.contacts);
      }
    } catch (error) {
      console.error("Failed to add contact:", error);
    }
  }

  // Check if user is already a contact
  hasContact(address) {
    return this.contacts.has(address);
  }

  // Get all contacts
  getContacts() {
    return Array.from(this.contacts.values());
  }

  // Invite user to room by address
  async inviteUserToRoom(roomId, userAddress) {
    try {
      if (!Utils.isValidEthereumAddress(userAddress)) {
        throw new Error("Invalid wallet address");
      }

      // Check if user is room creator or member
      const roomInfo = await this.getRoomInfo(roomId);
      if (!roomInfo) {
        throw new Error("Room not found");
      }

      // Send invitation
      const inviteData = {
        roomId: roomId,
        roomName: roomInfo.name || roomId,
        inviter: this.currentUser.address,
        inviterNickname: await this.getUserNickname(),
        invitedAt: Date.now(),
        status: "pending",
      };

      // Store invitation for the invited user
      await new Promise((resolve, reject) => {
        this.gun
          .get("invitations")
          .get(userAddress)
          .get(roomId)
          .put(inviteData, (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
      });

      // Auto-add user to room members (they can join directly)
      const memberData = {
        address: userAddress,
        nickname: Utils.shortenAddress(userAddress),
        joinedAt: Date.now(),
        role: "member",
        invitedBy: this.currentUser.address,
      };

      await new Promise((resolve, reject) => {
        this.roomsRef
          .get(roomId)
          .get("members")
          .get(userAddress)
          .put(memberData, (ack) => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          });
      });

      return true;
    } catch (error) {
      console.error("Failed to invite user:", error);
      throw error;
    }
  }

  // Check and load user invitations
  async loadUserInvitations() {
    try {
      if (!this.currentUser) return;

      this.gun
        .get("invitations")
        .get(this.currentUser.address)
        .map()
        .on((inviteData, roomId) => {
          if (
            inviteData &&
            roomId &&
            !roomId.startsWith("~") &&
            inviteData.status === "pending"
          ) {
            this.handleRoomInvitation(inviteData, roomId);
          }
        });
    } catch (error) {
      console.error("Failed to load invitations:", error);
    }
  }

  // Handle room invitation
  async handleRoomInvitation(inviteData, roomId) {
    try {
      // Add room to user's room list automatically
      this.userRooms.add(roomId);

      // Save to localStorage
      this.saveUserRooms();

      // Update UI
      if (window.app && window.app.ui) {
        window.app.ui.updateRoomList(this.userRooms, this.currentRoom);
        window.app.ui.showToast(
          `You've been invited to "${inviteData.roomName}" by ${inviteData.inviterNickname}`,
          "info",
          5000,
        );
      }

      // Mark invitation as accepted
      this.gun
        .get("invitations")
        .get(this.currentUser.address)
        .get(roomId)
        .get("status")
        .put("accepted");
    } catch (error) {
      console.error("Failed to handle room invitation:", error);
    }
  }

  // Add missing methods for online status management
  setUserOnline() {
    return this.setOnlineStatus(true);
  }

  setUserOffline() {
    return this.setOnlineStatus(false);
  }

  // Clean up listeners to prevent memory leaks and duplicates
  cleanupListeners() {
    this.messageListeners.forEach((listener) => {
      if (listener && listener.off) {
        listener.off();
      }
    });
    this.messageListeners = [];

    this.userListeners.forEach((listener) => {
      if (listener && listener.off) {
        listener.off();
      }
    });
    this.userListeners = [];
  }

  cleanup() {
    try {
      // Set offline status
      this.setOnlineStatus(false);

      // Save current state
      if (this.currentUser) {
        this.saveUserRooms();
      }

      // Clean up listeners properly
      this.cleanupListeners();

      // Clear references
      this.messagesRef = null;
      this.usersRef = null;
      this.directMessagesRef = null;
      this.currentRoomRef = null;
      this.currentUser = null;
      this.onlineUsers.clear();
      this.messageQueue = [];
      this.receivedMessages.clear();
      this.contacts.clear();
    } catch (error) {
      console.error("Failed to cleanup chat:", error);
    }
  }
}

// Export for use in other modules
window.Chat = Chat;
