const { verifyAccessToken } = require('../config/jwt');
const User = require('../models/User');
const Host = require('../models/Host');
const { validateSdp, validateIceCandidate } = require('../services/webrtcService');
const logger = require('../utils/logger');

const connectedUsers = new Map(); // Map<userId, socketId>
const socketUsers = new Map(); // Map<socketId, userId>

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

    // Handle authentication event (for additional tracking)
    socket.on('authenticate', (authUserId) => {
      logger.info(`User ${authUserId} authenticated with socket ${socket.id}`);
    });

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
    socket.on('disconnect', async () => {
      try {
        connectedUsers.delete(userId);
        socketUsers.delete(socket.id);
        
        // Check if user is a host and mark them offline
        if (socket.user.role === 'host') {
          const host = await Host.findOne({ userId: socket.user._id });
          
          if (host && host.isOnline) {
            host.isOnline = false;
            host.lastSeen = new Date();
            await host.save();
            
            logger.info(`Host ${socket.user.email} marked offline due to socket disconnect`);
            
            // Notify all users that host went offline
            io.emit('host:offline', { 
              hostId: host._id,
              userId: socket.user._id 
            });
          }
        }
        
        // Notify others user is offline
        socket.broadcast.emit('user:offline', { userId });
        
        logger.info(`User disconnected: ${socket.user.email} (${socket.id})`);
      } catch (error) {
        logger.error(`Error handling disconnect for ${userId}: ${error.message}`);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${userId}: ${error.message}`);
    });
  });

  // Periodic cleanup job to mark inactive hosts as offline
  const cleanupInactiveHosts = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // Find hosts that are marked online but haven't been seen in 5+ minutes
      const inactiveHosts = await Host.find({
        isOnline: true,
        lastSeen: { $lt: fiveMinutesAgo }
      });

      if (inactiveHosts.length > 0) {
        // Mark them offline
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
        
        // Notify all users about each host going offline
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

  // Run cleanup every 5 minutes
  const cleanupInterval = setInterval(cleanupInactiveHosts, 5 * 60 * 1000);
  
  // Run cleanup on server start
  cleanupInactiveHosts();

  // Clean up interval on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
  });
};

module.exports = socketHandler;