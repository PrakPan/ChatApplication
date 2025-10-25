const { verifyAccessToken } = require('../config/jwt');
const User = require('../models/User');
const { validateSdp, validateIceCandidate } = require('../services/webrtcService');
const logger = require('../utils/logger');

const connectedUsers = new Map(); // Map
const socketUsers = new Map(); // Map

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

    // Handle call offer
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

    // Handle call answer
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

    // Handle ICE candidates
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

    // Handle call rejection
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

    // Handle call end
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

    // Handle disconnect
    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      socketUsers.delete(socket.id);
      
      // Notify others user is offline
      socket.broadcast.emit('user:offline', { userId });
      
      logger.info(`User disconnected: ${socket.user.email} (${socket.id})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${userId}: ${error.message}`);
    });
  });
};

module.exports = socketHandler;