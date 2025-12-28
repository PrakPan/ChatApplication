const { verifyAccessToken } = require('../config/jwt');
const User = require('../models/User');
const Host = require('../models/Host');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { validateSdp, validateIceCandidate } = require('../services/webrtcService');
const logger = require('../utils/logger');

const connectedUsers = new Map();
const socketUsers = new Map(); 
const typingUsers = new Map(); 
const activeCalls = new Map();

const socketHandler = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.user = user;
      socket.userId = user._id.toString(); 
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId; // Use the pre-converted string

    connectedUsers.set(userId, socket.id);
    socketUsers.set(socket.id, userId);
    
    logger.info(`✅ User connected: ${socket.user.email} (${socket.id}) - UserId: ${userId}`);
    console.log('📋 Connected users map updated. Total connected:', connectedUsers.size);

    socket.broadcast.emit('user:online', { userId });

    // ==================== DIRECT MESSAGING EVENTS ====================

    socket.on('chat:join', async ({ recipientId }) => {
      try {
        const conversationId = Message.generateConversationId(userId, recipientId);
        socket.join(conversationId);
        logger.info(`User ${userId} joined conversation ${conversationId}`);

        await Message.updateMany(
          {
            conversationId,
            recipient: userId,
            status: 'sent'
          },
          {
            $set: { status: 'delivered', deliveredAt: new Date() }
          }
        );

        const recipientIdStr = recipientId?.toString() || recipientId;
        const recipientSocketId = connectedUsers.get(recipientIdStr);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('messages:delivered', { conversationId });
        }
      } catch (error) {
        logger.error(`Error joining conversation: ${error.message}`);
      }
    });

    socket.on('chat:leave', ({ recipientId }) => {
      const conversationId = Message.generateConversationId(userId, recipientId);
      socket.leave(conversationId);
      logger.info(`User ${userId} left conversation ${conversationId}`);
    });

// In message:send event handler
socket.on('message:send', async (data) => {
  try {
    const { recipientId, content, messageType = 'text', replyTo, callId, tempId } = data;
    
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      socket.emit('message:error', { message: 'Recipient not found' });
      return;
    }

    const conversationId = Message.generateConversationId(userId, recipientId);

    const message = await Message.create({
      conversationId,
      sender: userId,
      recipient: recipientId,
      messageType,
      content: messageType === 'text' ? content : undefined,
      mediaUrl: messageType === 'image' || messageType === 'file' ? content : undefined,
      replyTo,
      callId,
      status: 'sent'
    });

    await message.populate('sender', 'name avatar userId');
    if (replyTo) {
      await message.populate('replyTo', 'content messageType sender');
    }

    const conversation = await Conversation.findOrCreate(userId, recipientId);
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();
    await conversation.incrementUnread(recipientId);

    // Format message consistently
    const formattedMessage = {
      _id: message._id,
      senderId: message.sender._id,
      sender: message.sender,
      message: message.content,
      content: message.content,
      messageType: message.messageType,
      createdAt: message.createdAt,
      status: message.status,
      conversationId: message.conversationId
    };

    // Send confirmation to sender
    socket.emit('message:sent', {
      tempId: tempId,
      message: formattedMessage
    });

    const recipientIdStr = recipientId?.toString() || recipientId;
    const recipientSocketId = connectedUsers.get(recipientIdStr);
    
    console.log('📤 Sending message to recipient:', recipientIdStr);
    console.log('📍 Recipient socket ID:', recipientSocketId);
    
    if (recipientSocketId) {
      // CRITICAL: Emit to BOTH event names for compatibility
      io.to(recipientSocketId).emit('chat:message', formattedMessage);
      io.to(recipientSocketId).emit('message:receive', {
        message: formattedMessage,
        conversation: {
          conversationId,
          unreadCount: conversation.unreadCount.get(recipientId.toString())
        }
      });

      // Check if recipient is in the conversation room
      const recipientSocket = io.sockets.sockets.get(recipientSocketId);
      if (recipientSocket) {
        const rooms = Array.from(recipientSocket.rooms);
        
        if (rooms.includes(conversationId)) {
          message.status = 'delivered';
          message.deliveredAt = new Date();
          await message.save();
          
          socket.emit('message:delivered', { messageId: message._id });
        }
      }
      
      console.log('✅ Message emitted to recipient socket');
    } else {
      console.log('⚠️ Recipient is offline');
    }

    logger.info(`Message sent from ${userId} to ${recipientId}`);
  } catch (error) {
    logger.error(`Error sending message: ${error.message}`);
    socket.emit('message:error', { message: 'Failed to send message' });
  }
});

// Fix messages:read event
socket.on('messages:read', async ({ recipientId, messageIds }) => {
  try {
    const conversationId = Message.generateConversationId(userId, recipientId);

    await Message.updateMany(
      {
        _id: { $in: messageIds },
        recipient: userId,
        status: { $ne: 'read' }
      },
      {
        $set: { status: 'read', readAt: new Date() }
      }
    );

    const conversation = await Conversation.findOne({ conversationId });
    if (conversation) {
      await conversation.resetUnread(userId);
    }

    const recipientIdStr = recipientId?.toString() || recipientId;
    const recipientSocketId = connectedUsers.get(recipientIdStr);
    
    if (recipientSocketId) {
      // Emit to BOTH event names
      io.to(recipientSocketId).emit('messages:read', {
        conversationId,
        messageIds,
        readBy: userId
      });
      io.to(recipientSocketId).emit('chat:read', {
        userId: userId,
        messageIds
      });
    }

    console.log('✅ Messages marked as read, notification sent');
  } catch (error) {
    logger.error(`Error marking messages as read: ${error.message}`);
  }
});

// Add a chat:mark-read event for frontend compatibility
socket.on('chat:mark-read', async ({ to }) => {
  try {
    const conversationId = Message.generateConversationId(userId, to);

    const unreadMessages = await Message.find({
      conversationId,
      recipient: userId,
      status: { $ne: 'read' }
    }).select('_id');

    const messageIds = unreadMessages.map(msg => msg._id);

    if (messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $set: { status: 'read', readAt: new Date() } }
      );

      const conversation = await Conversation.findOne({ conversationId });
      if (conversation) {
        await conversation.resetUnread(userId);
      }

      const recipientIdStr = to?.toString() || to;
      const recipientSocketId = connectedUsers.get(recipientIdStr);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('chat:read', {
          userId: userId,
          messageIds
        });
      }
    }
  } catch (error) {
    logger.error(`Error in chat:mark-read: ${error.message}`);
  }
});

// Fix typing events
socket.on('chat:typing', ({ to }) => {
  const recipientIdStr = to?.toString() || to;
  const recipientSocketId = connectedUsers.get(recipientIdStr);
  
  if (recipientSocketId) {
    io.to(recipientSocketId).emit('chat:typing', {
      userId: userId,
      user: {
        name: socket.user.name,
        avatar: socket.user.avatar
      }
    });
  }
});

socket.on('chat:stop-typing', ({ to }) => {
  const recipientIdStr = to?.toString() || to;
  const recipientSocketId = connectedUsers.get(recipientIdStr);
  
  if (recipientSocketId) {
    io.to(recipientSocketId).emit('chat:stop-typing', {
      userId: userId
    });
  }
});

// Add chat:send event for direct compatibility with frontend
socket.on('chat:send', async ({ to, message }) => {
  try {
    const recipientIdStr = to?.toString() || to;
    const recipientSocketId = connectedUsers.get(recipientIdStr);
    
    if (recipientSocketId) {
      // Forward the already-saved message to recipient
      io.to(recipientSocketId).emit('chat:message', message);
      console.log('✅ Chat message forwarded via chat:send');
    }
  } catch (error) {
    logger.error(`Error in chat:send: ${error.message}`);
  }
});

    socket.on('typing:start', ({ recipientId }) => {
      const conversationId = Message.generateConversationId(userId, recipientId);
      
      if (!typingUsers.has(conversationId)) {
        typingUsers.set(conversationId, new Set());
      }
      typingUsers.get(conversationId).add(userId);

      const recipientIdStr = recipientId?.toString() || recipientId;
      const recipientSocketId = connectedUsers.get(recipientIdStr);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('typing:start', {
          conversationId,
          userId,
          user: {
            name: socket.user.name,
            avatar: socket.user.avatar
          }
        });
      }
    });

    socket.on('typing:stop', ({ recipientId }) => {
      const conversationId = Message.generateConversationId(userId, recipientId);
      
      if (typingUsers.has(conversationId)) {
        typingUsers.get(conversationId).delete(userId);
        if (typingUsers.get(conversationId).size === 0) {
          typingUsers.delete(conversationId);
        }
      }

      const recipientIdStr = recipientId?.toString() || recipientId;
      const recipientSocketId = connectedUsers.get(recipientIdStr);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('typing:stop', {
          conversationId,
          userId
        });
      }
    });

    socket.on('message:delete', async ({ messageId, deleteForEveryone }) => {
      try {
        const message = await Message.findById(messageId);
        
        if (!message) {
          socket.emit('message:error', { message: 'Message not found' });
          return;
        }

        if (message.sender.toString() !== userId) {
          socket.emit('message:error', { message: 'Unauthorized' });
          return;
        }

        if (deleteForEveryone) {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (message.createdAt < oneHourAgo) {
            socket.emit('message:error', { 
              message: 'Can only delete for everyone within 1 hour' 
            });
            return;
          }

          message.isDeleted = true;
          message.content = 'This message was deleted';
          await message.save();

          const conversationId = message.conversationId;
          io.to(conversationId).emit('message:deleted', {
            messageId,
            deleteForEveryone: true
          });
        } else {
          if (!message.deletedFor.includes(userId)) {
            message.deletedFor.push(userId);
            await message.save();
          }

          socket.emit('message:deleted', {
            messageId,
            deleteForEveryone: false
          });
        }

        logger.info(`Message ${messageId} deleted by ${userId}`);
      } catch (error) {
        logger.error(`Error deleting message: ${error.message}`);
        socket.emit('message:error', { message: 'Failed to delete message' });
      }
    });

    socket.on('message:react', async ({ messageId, emoji }) => {
      try {
        const message = await Message.findById(messageId);
        
        if (!message) {
          socket.emit('message:error', { message: 'Message not found' });
          return;
        }

        const existingReaction = message.reactions.find(
          r => r.user.toString() === userId && r.emoji === emoji
        );

        if (existingReaction) {
          message.reactions = message.reactions.filter(
            r => !(r.user.toString() === userId && r.emoji === emoji)
          );
        } else {
          message.reactions.push({
            user: userId,
            emoji,
            createdAt: new Date()
          });
        }

        await message.save();

        const conversationId = message.conversationId;
        io.to(conversationId).emit('message:reaction', {
          messageId,
          reactions: message.reactions
        });

        logger.info(`Reaction ${emoji} ${existingReaction ? 'removed' : 'added'} to message ${messageId}`);
      } catch (error) {
        logger.error(`Error reacting to message: ${error.message}`);
        socket.emit('message:error', { message: 'Failed to react to message' });
      }
    });

    // ==================== VIDEO CALL EVENTS ====================

    socket.on('call:offer', async ({ to, offer, callId }) => {
      try {
        console.log('📞 ========== CALL OFFER RECEIVED ==========');
        console.log('From User ID:', userId);
        console.log('To User ID (raw):', to);
        console.log('Call ID:', callId);
        console.log('Offer SDP type:', offer?.type);
        
        if (!validateSdp(offer)) {
          console.log('❌ Invalid SDP offer');
          socket.emit('call:error', { message: 'Invalid offer' });
          return;
        }

        const toUserId = to?.toString() || to;
        console.log('To User ID (string):', toUserId);
        
        console.log('📋 All connected users:');
        connectedUsers.forEach((socketId, uid) => {
          console.log(`  - userId: "${uid}" -> socketId: ${socketId}`);
        });
        
        const recipientSocketId = connectedUsers.get(toUserId);
        
        if (recipientSocketId) {
          console.log('✅ Found recipient socket:', recipientSocketId);
          
          // Store active call
          activeCalls.set(callId, {
            caller: userId,
            receiver: toUserId,
            startTime: new Date()
          });
          
          io.to(recipientSocketId).emit('call:offer', {
            from: userId,
            offer,
            callId,
            caller: {
              id: socket.user._id,
              name: socket.user.name,
              avatar: socket.user.avatar
            }
          });
          
          console.log('📤 Call offer sent successfully');
        } else {
          console.log('❌ Recipient NOT FOUND');
          console.log('❌ Searched for:', toUserId);
          socket.emit('call:error', { message: 'Recipient is offline' });
        }
        
        console.log('==========================================');
      } catch (error) {
        console.error('Error handling call offer:', error);
        socket.emit('call:error', { message: 'Failed to send offer' });
      }
    });

    socket.on('call:answer', async ({ to, answer }) => {
      try {
        console.log('📞 CALL ANSWER from', userId, 'to', to);
        
        if (!validateSdp(answer)) {
          socket.emit('call:error', { message: 'Invalid answer' });
          return;
        }

        const toUserId = to?.toString() || to;
        const recipientSocketId = connectedUsers.get(toUserId);
        
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('call:answer', {
            from: userId,
            answer
          });
          console.log('✅ Call answer sent');
          logger.info(`Call answer sent from ${userId} to ${toUserId}`);
        } else {
          console.log('❌ Recipient not found for call answer');
        }
      } catch (error) {
        logger.error(`Error handling call answer: ${error.message}`);
        socket.emit('call:error', { message: 'Failed to send answer' });
      }
    });

    socket.on('call:ice-candidate', async ({ to, candidate }) => {
      try {
        if (!validateIceCandidate(candidate)) {
          return;
        }

        const toUserId = to?.toString() || to;
        const recipientSocketId = connectedUsers.get(toUserId);
        
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('call:ice-candidate', {
            from: userId,
            candidate
          });
        }
      } catch (error) {
        logger.error(`Error handling ICE candidate: ${error.message}`);
      }
    });

    socket.on('call:reject', ({ to, callId, reason }) => {
      console.log('📞 CALL REJECTED by', userId);
      const toUserId = to?.toString() || to;
      const recipientSocketId = connectedUsers.get(toUserId);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call:rejected', {
          from: userId,
          callId,
          reason
        });
        
        // Remove from active calls
        activeCalls.delete(callId);
        
        logger.info(`Call rejected by ${userId}`);
      }
    });

    socket.on('call:end', ({ to, callId }) => {
      console.log('📞 CALL ENDED by', userId);
      const toUserId = to?.toString() || to;
      const recipientSocketId = connectedUsers.get(toUserId);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call:ended', {
          from: userId,
          callId
        });
        
        // Remove from active calls
        activeCalls.delete(callId);
        
        logger.info(`Call ended by ${userId}`);
      }
    });

    // ==================== IN-CALL CHAT EVENTS ====================
    // These are for sending messages DURING a video call
    
    socket.on('call:chat:send', ({ callId, to, message }) => {
      try {
        console.log('💬 IN-CALL MESSAGE from', userId, 'to', to);
        
        const toUserId = to?.toString() || to;
        const recipientSocketId = connectedUsers.get(toUserId);
        
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('call:chat:receive', {
            from: userId,
            callId,
            message,
            sender: {
              name: socket.user.name,
              avatar: socket.user.avatar
            },
            timestamp: new Date()
          });
          
          // Send confirmation to sender
          socket.emit('call:chat:sent', {
            tempId: message.tempId,
            callId,
            timestamp: new Date()
          });
          
          console.log('✅ In-call message delivered');
        } else {
          console.log('❌ Recipient not found for in-call message');
          socket.emit('call:chat:error', { 
            message: 'Recipient is offline',
            callId 
          });
        }
      } catch (error) {
        console.error('Error sending in-call message:', error);
        socket.emit('call:chat:error', { 
          message: 'Failed to send message',
          callId 
        });
      }
    });

    socket.on('call:chat:typing', ({ callId, to }) => {
      const toUserId = to?.toString() || to;
      const recipientSocketId = connectedUsers.get(toUserId);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call:chat:typing', {
          from: userId,
          callId,
          user: {
            name: socket.user.name
          }
        });
      }
    });

    socket.on('call:chat:stop-typing', ({ callId, to }) => {
      const toUserId = to?.toString() || to;
      const recipientSocketId = connectedUsers.get(toUserId);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call:chat:stop-typing', {
          from: userId,
          callId
        });
      }
    });

    // ==================== DISCONNECT ====================

  // socketHandler.js - Update disconnect handler
socket.on('disconnect', async () => {
  try {
    connectedUsers.delete(userId);
    socketUsers.delete(socket.id);
    
    console.log('❌ User disconnected:', userId);
    console.log('📋 Remaining connected users:', connectedUsers.size);
    
    // Clear typing indicators
    typingUsers.forEach((users, conversationId) => {
      if (users.has(userId)) {
        users.delete(userId);
        if (users.size === 0) {
          typingUsers.delete(conversationId);
        }
      }
    });
    
    // End any active calls
    activeCalls.forEach((callData, callId) => {
      if (callData.caller === userId || callData.receiver === userId) {
        const otherUserId = callData.caller === userId ? callData.receiver : callData.caller;
        const otherSocketId = connectedUsers.get(otherUserId);
        
        if (otherSocketId) {
          io.to(otherSocketId).emit('call:ended', {
            from: userId,
            callId,
            reason: 'disconnect'
          });
        }
        
        activeCalls.delete(callId);
      }
    });
    
    // Handle host disconnect - UPDATE lastSeen but DON'T mark offline immediately
    if (socket.user.role === 'host') {
      const host = await Host.findOne({ userId: socket.user._id });
      
      if (host && host.isOnline) {
        // Only update lastSeen, don't change isOnline
        // The cleanup job will handle marking offline after grace period
        host.lastSeen = new Date();
        await host.save({ validateBeforeSave: false }); // Skip pre-save hooks
        
        logger.info(`Host ${socket.user.email} disconnected, lastSeen updated`);
      }
    }
    
    socket.broadcast.emit('user:offline', { userId });
    
    logger.info(`User disconnected: ${socket.user.email} (${socket.id})`);
  } catch (error) {
    logger.error(`Error handling disconnect for ${userId}: ${error.message}`);
  }
});

    socket.on('error', (error) => {
      logger.error(`Socket error for ${userId}: ${error.message}`);
    });
  });

  // Cleanup job
// socketHandler.js - Update cleanup job
const cleanupInactiveHosts = async () => {
  try {
    // Increase to 10 minutes grace period (was 5 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const inactiveHosts = await Host.find({
      isOnline: true,
      lastSeen: { $lt: tenMinutesAgo }
    });

    if (inactiveHosts.length > 0) {
      for (const host of inactiveHosts) {
        // Check if host is still connected via socket
        const hostUserId = host.userId.toString();
        const isStillConnected = connectedUsers.has(hostUserId);
        
        if (isStillConnected) {
          // Host is still connected, just update lastSeen
          host.lastSeen = new Date();
          await host.save({ validateBeforeSave: false });
          console.log(`✅ Host ${host._id} is still connected, updated lastSeen`);
        } else {
          // Host is truly disconnected, mark offline
          host.isOnline = false;
          host.callStatus = 'offline';
          host.currentCallId = null;
          await host.save();
          
          io.emit('host:offline', { 
            hostId: host._id,
            userId: host.userId 
          });
          
          logger.info(`Cleanup: Marked host ${host._id} as offline`);
        }
      }
      
      logger.info(`Cleanup: Processed ${inactiveHosts.length} potentially inactive hosts`);
    }
  } catch (error) {
    logger.error(`Error in cleanup job: ${error.message}`);
  }
};

// Run cleanup every 5 minutes (more frequently to check)
const cleanupInterval = setInterval(cleanupInactiveHosts, 5 * 60 * 1000);
cleanupInactiveHosts();

  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
  });
};

module.exports = socketHandler;