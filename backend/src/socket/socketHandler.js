const { verifyAccessToken } = require('../config/jwt');
const User = require('../models/User');
const Host = require('../models/Host');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { validateSdp, validateIceCandidate } = require('../services/webrtcService');
const logger = require('../utils/logger');

const connectedUsers = new Map(); // Map<userId, socketId>
const socketUsers = new Map(); // Map<socketId, userId>
const typingUsers = new Map(); // Map<conversationId, Set<userId>>

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
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    
    // Store connection
    connectedUsers.set(userId, socket.id);
    socketUsers.set(socket.id, userId);
    
    logger.info(`User connected: ${socket.user.email} (${socket.id})`);

    // Notify user is online
    socket.broadcast.emit('user:online', { userId });

    // ==================== CHAT EVENTS ====================

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
        const recipientSocketId = connectedUsers.get(recipientId);
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

    // Send message
    socket.on('message:send', async (data) => {
      try {
        const { recipientId, content, messageType = 'text', replyTo, callId } = data;

        // Validate recipient
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          socket.emit('message:error', { message: 'Recipient not found' });
          return;
        }

        // Generate conversation ID
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

        // Populate sender info
        await message.populate('sender', 'name avatar userId');
        if (replyTo) {
          await message.populate('replyTo', 'content messageType sender');
        }

        // Update or create conversation
        const conversation = await Conversation.findOrCreate(userId, recipientId);
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        await conversation.incrementUnread(recipientId);

        // Emit to sender (confirmation)
        socket.emit('message:sent', {
          tempId: data.tempId, // For client-side optimistic updates
          message: message.toJSON()
        });

        // Check if recipient is online and in the conversation
        const recipientSocketId = connectedUsers.get(recipientId);
        if (recipientSocketId) {
          // Send to recipient
          io.to(recipientSocketId).emit('message:receive', {
            message: message.toJSON(),
            conversation: {
              conversationId,
              unreadCount: conversation.unreadCount.get(recipientId.toString())
            }
          });

          // Check if recipient is in the conversation room (has it open)
          const recipientSocket = io.sockets.sockets.get(recipientSocketId);
          const rooms = Array.from(recipientSocket.rooms);
          
          if (rooms.includes(conversationId)) {
            // Auto-mark as delivered since recipient has conversation open
            message.status = 'delivered';
            message.deliveredAt = new Date();
            await message.save();
            
            socket.emit('message:delivered', { messageId: message._id });
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

        // Update messages to read status
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

        // Reset unread count
        const conversation = await Conversation.findOne({ conversationId });
        if (conversation) {
          await conversation.resetUnread(userId);
        }

        // Notify sender
        const recipientSocketId = connectedUsers.get(recipientId);
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

    // Typing indicator
    socket.on('typing:start', ({ recipientId }) => {
      const conversationId = Message.generateConversationId(userId, recipientId);
      
      if (!typingUsers.has(conversationId)) {
        typingUsers.set(conversationId, new Set());
      }
      typingUsers.get(conversationId).add(userId);

      const recipientSocketId = connectedUsers.get(recipientId);
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

      const recipientSocketId = connectedUsers.get(recipientId);
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
          // Delete for everyone (within 1 hour of sending)
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

          // Notify both users
          const conversationId = message.conversationId;
          io.to(conversationId).emit('message:deleted', {
            messageId,
            deleteForEveryone: true
          });
        } else {
          // Delete for self only
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

        // Check if user already reacted with this emoji
        const existingReaction = message.reactions.find(
          r => r.user.toString() === userId && r.emoji === emoji
        );

        if (existingReaction) {
          // Remove reaction
          message.reactions = message.reactions.filter(
            r => !(r.user.toString() === userId && r.emoji === emoji)
          );
        } else {
          // Add reaction
          message.reactions.push({
            user: userId,
            emoji,
            createdAt: new Date()
          });
        }

        await message.save();

        // Notify both users in conversation
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

    socket.on('authenticate', (authUserId) => {
      logger.info(`User ${authUserId} authenticated with socket ${socket.id}`);
    });

    socket.on('call:offer', async ({ to, offer, callId }) => {
      try {
        if (!validateSdp(offer)) {
          socket.emit('call:error', { message: 'Invalid offer' });
          return;
        }

        const recipientSocketId = connectedUsers.get(to);
        
        if (recipientSocketId) {
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
          logger.info(`Call offer sent from ${userId} to ${to}`);
        } else {
          socket.emit('call:error', { message: 'Recipient is offline' });
        }
      } catch (error) {
        logger.error(`Error handling call offer: ${error.message}`);
        socket.emit('call:error', { message: 'Failed to send offer' });
      }
    });

    socket.on('call:answer', async ({ to, answer }) => {
      try {
        if (!validateSdp(answer)) {
          socket.emit('call:error', { message: 'Invalid answer' });
          return;
        }

        const recipientSocketId = connectedUsers.get(to);
        
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('call:answer', {
            from: userId,
            answer
          });
          logger.info(`Call answer sent from ${userId} to ${to}`);
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

        const recipientSocketId = connectedUsers.get(to);
        
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
      const recipientSocketId = connectedUsers.get(to);
      
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
      const recipientSocketId = connectedUsers.get(to);
      
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
        
        // Clear typing indicators
        typingUsers.forEach((users, conversationId) => {
          if (users.has(userId)) {
            users.delete(userId);
            if (users.size === 0) {
              typingUsers.delete(conversationId);
            }
          }
        });
        
        // Check if user is a host and mark them offline
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

  // Periodic cleanup job
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