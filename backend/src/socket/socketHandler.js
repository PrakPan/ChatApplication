// ============================================
// FIXED socketHandler.js - Add socket.userId
// ============================================

const { verifyAccessToken } = require('../config/jwt');
const User = require('../models/User');
const Host = require('../models/Host');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { validateSdp, validateIceCandidate } = require('../services/webrtcService');
const logger = require('../utils/logger');

const connectedUsers = new Map(); // Map<userId (string), socketId>
const socketUsers = new Map(); // Map<socketId, userId (string)>
const typingUsers = new Map(); // Map<conversationId, Set<userId>>

// Helper function to find socket by userId
const findSocketByUserId = (io, userId) => {
  const sockets = io.sockets.sockets;
  for (let [socketId, socket] of sockets) {
    if (socket.userId === userId.toString()) {
      return socket;
    }
  }
  return null;
};

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

      // ✅ FIX: Set both socket.user AND socket.userId
      socket.user = user;
      socket.userId = user._id.toString(); // CRITICAL: Add this line
      
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    // ✅ Now socket.userId is available
    const userId = socket.userId; // Use socket.userId instead of socket.user._id.toString()
    
    // Store connection
    connectedUsers.set(userId, socket.id);
    socketUsers.set(socket.id, userId);
    
    logger.info(`User connected: ${socket.user.email} (${socket.id}) - UserId: ${userId}`);
    console.log('✅ Socket authenticated - userId:', userId);

    // Notify user is online
    socket.broadcast.emit('user:online', { userId });

    // ==================== CHAT EVENTS ====================

    // Handle sending messages via socket
    socket.on('chat:send', async ({ to, message }) => {
      try {
        console.log('💬 Sending message from', socket.userId, 'to', to);
        
        // Find recipient's socket
        const recipientSocket = findSocketByUserId(io, to);
        
        if (recipientSocket) {
          // Emit to recipient - they'll see it instantly
          recipientSocket.emit('chat:message', message);
          console.log('✅ Message delivered to recipient instantly');
        } else {
          console.log('⚠️ Recipient not online, message saved but not delivered in real-time');
        }
        
        // Emit back to sender for confirmation
        socket.emit('chat:message-sent', {
          success: true,
          messageId: message._id
        });
      } catch (error) {
        console.error('Error sending message via socket:', error);
        socket.emit('chat:error', {
          message: 'Failed to send message'
        });
      }
    });

    // Handle typing indicators
    socket.on('chat:typing', ({ to }) => {
      console.log('⌨️ User typing:', socket.userId, '→', to);
      const recipientSocket = findSocketByUserId(io, to);
      if (recipientSocket) {
        recipientSocket.emit('chat:typing', {
          userId: socket.userId
        });
        console.log('✅ Typing indicator sent');
      }
    });

    socket.on('chat:stop-typing', ({ to }) => {
      console.log('⏸️ User stopped typing:', socket.userId, '→', to);
      const recipientSocket = findSocketByUserId(io, to);
      if (recipientSocket) {
        recipientSocket.emit('chat:stop-typing', {
          userId: socket.userId
        });
        console.log('✅ Stop typing indicator sent');
      }
    });

    // Handle read receipts
    socket.on('chat:mark-read', ({ to }) => {
      console.log('✅ Messages marked as read by:', socket.userId);
      const recipientSocket = findSocketByUserId(io, to);
      if (recipientSocket) {
        recipientSocket.emit('chat:read', {
          userId: socket.userId
        });
        console.log('✅ Read receipt sent to sender');
      }
    });

    // Join conversation room
    socket.on('chat:join', async ({ recipientId }) => {
      try {
        const conversationId = Message.generateConversationId(userId, recipientId);
        socket.join(conversationId);
        logger.info(`User ${userId} joined conversation ${conversationId}`);

        // Mark messages as delivered
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

        // Notify sender about delivery
        const recipientSocketId = connectedUsers.get(recipientId?.toString() || recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('messages:delivered', { conversationId });
        }
      } catch (error) {
        logger.error(`Error joining conversation: ${error.message}`);
      }
    });

    // Leave conversation room
    socket.on('chat:leave', ({ recipientId }) => {
      const conversationId = Message.generateConversationId(userId, recipientId);
      socket.leave(conversationId);
      logger.info(`User ${userId} left conversation ${conversationId}`);
    });

    // Send message (legacy event)
    socket.on('message:send', async (data) => {
      try {
        const { recipientId, content, messageType = 'text', replyTo, callId } = data;

        // Validate recipient
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          socket.emit('message:error', { message: 'Recipient not found' });
          return;
        }

        const conversationId = Message.generateConversationId(userId, recipientId);

        // Create message
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

        // Update conversation
        const conversation = await Conversation.findOrCreate(userId, recipientId);
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        await conversation.incrementUnread(recipientId);

        // Emit to sender
        socket.emit('message:sent', {
          tempId: data.tempId,
          message: message.toJSON()
        });

        const recipientIdStr = recipientId?.toString() || recipientId;
        const recipientSocketId = connectedUsers.get(recipientIdStr);
        
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('message:receive', {
            message: message.toJSON(),
            conversation: {
              conversationId,
              unreadCount: conversation.unreadCount.get(recipientId.toString())
            }
          });

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
        }

        logger.info(`Message sent from ${userId} to ${recipientId}`);
      } catch (error) {
        logger.error(`Error sending message: ${error.message}`);
        socket.emit('message:error', { message: 'Failed to send message' });
      }
    });

    // Mark messages as read
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
          io.to(recipientSocketId).emit('messages:read', {
            conversationId,
            messageIds,
            readBy: userId
          });
        }

        logger.info(`Messages marked as read in conversation ${conversationId}`);
      } catch (error) {
        logger.error(`Error marking messages as read: ${error.message}`);
      }
    });

    // Typing indicator (legacy)
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

    // Delete message
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

    // React to message
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
        console.log('To User ID:', to);
        console.log('Call ID:', callId);
        
        if (!validateSdp(offer)) {
          console.log('❌ Invalid SDP offer');
          socket.emit('call:error', { message: 'Invalid offer' });
          return;
        }

        const toUserId = to?.toString() || to;
        const recipientSocketId = connectedUsers.get(toUserId);
        
        if (recipientSocketId) {
          console.log('✅ Found recipient socket:', recipientSocketId);
          
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
          socket.emit('call:error', { message: 'Recipient is offline' });
        }
      } catch (error) {
        console.error('Error handling call offer:', error);
        socket.emit('call:error', { message: 'Failed to send offer' });
      }
    });

    socket.on('call:answer', async ({ to, answer }) => {
      try {
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
          logger.info(`Call answer sent from ${userId} to ${toUserId}`);
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
      const toUserId = to?.toString() || to;
      const recipientSocketId = connectedUsers.get(toUserId);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call:rejected', {
          from: userId,
          callId,
          reason
        });
        logger.info(`Call rejected by ${userId}`);
      }
    });

    socket.on('call:end', ({ to, callId }) => {
      const toUserId = to?.toString() || to;
      const recipientSocketId = connectedUsers.get(toUserId);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call:ended', {
          from: userId,
          callId
        });
        logger.info(`Call ended by ${userId}`);
      }
    });

    // ==================== DISCONNECT ====================

    socket.on('disconnect', async () => {
      try {
        connectedUsers.delete(userId);
        socketUsers.delete(socket.id);
        
        typingUsers.forEach((users, conversationId) => {
          if (users.has(userId)) {
            users.delete(userId);
            if (users.size === 0) {
              typingUsers.delete(conversationId);
            }
          }
        });
        
        if (socket.user.role === 'host') {
          const host = await Host.findOne({ userId: socket.user._id });
          
          if (host && host.isOnline) {
            host.isOnline = false;
            host.lastSeen = new Date();
            await host.save();
            
            logger.info(`Host ${socket.user.email} marked offline due to socket disconnect`);
            
            io.emit('host:offline', { 
              hostId: host._id,
              userId: socket.user._id 
            });
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
  const cleanupInactiveHosts = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const inactiveHosts = await Host.find({
        isOnline: true,
        lastSeen: { $lt: fiveMinutesAgo }
      });

      if (inactiveHosts.length > 0) {
        await Host.updateMany(
          {
            isOnline: true,
            lastSeen: { $lt: fiveMinutesAgo }
          },
          {
            $set: { isOnline: false }
          }
        );
        
        logger.info(`Cleanup: Marked ${inactiveHosts.length} inactive hosts as offline`);
        
        inactiveHosts.forEach(host => {
          io.emit('host:offline', { 
            hostId: host._id,
            userId: host.userId 
          });
        });
      }
    } catch (error) {
      logger.error(`Error in cleanup job: ${error.message}`);
    }
  };

  const cleanupInterval = setInterval(cleanupInactiveHosts, 5 * 60 * 1000);
  cleanupInactiveHosts();

  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
  });
};

module.exports = socketHandler;