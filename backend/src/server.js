require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('./config/database');
const socketHandler = require('./socket/socketHandler');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const User = require('./models/User');
const Host = require('./models/Host');
const Call = require('./models/Call');
const Transaction = require('./models/Transaction');
const Withdrawal = require('./models/Withdrawal');
const Level = require('./models/Level');

// Import routes
const authRoutes = require('./routes/authRoutes');
const hostRoutes = require('./routes/hostRoutes');
const coinRoutes = require('./routes/coinRoutes');
const callRoutes = require('./routes/callRoutes');
const adminRoutes = require('./routes/adminRoutes');
const photoApprovalRoutes = require("./routes/photoApproval")
const messageRoutes = require("./routes/messageRoutes")
const coinSellerRoutes = require('./routes/coinSellerRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const followRoutes = require('./routes/followRoutes');
const agentRoutes = require('./routes/agentRoutes');
const profileRoutes = require('./routes/profileRoutes');
const levelRoutes = require('./routes/levelRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const freeTargetRoutes = require('./routes/freeTargetRoutes');
const passwordResetRoutes = require('./routes/passwordResetRoutes');
const FreeTarget = require('./models/FreeTarget');
const { scheduleJob, scheduleWeeklyRewards } = require('./utils/cronJobs');

const giftRoutes = require('./routes/giftRoutes');



// Initialize express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'https://chat-application-khaki-two.vercel.app',
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Connect to database
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://chat-application-khaki-two.vercel.app',
      'https://catlive.in',
      'https://www.catlive.in',
      'http://localhost:3000',
      'http://localhost:5173'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // You can also allow all origins in development
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize data
app.use(mongoSanitize());
app.use(xss());

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Rate limiting
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/free-target', freeTargetRoutes);
app.use('/api/v1/password-reset', passwordResetRoutes);
app.use('/api/v1/coin_sellers', coinSellerRoutes);
app.use('/api/v1/hosts', hostRoutes);
app.use('/api/v1/coins', coinRoutes);
app.use('/api/v1/calls', callRoutes);
// app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin', photoApprovalRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/profile', profileRoutes);

app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/follow', followRoutes);
app.use('/api/v1/agents', agentRoutes);
// app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/withdrawals',withdrawalRoutes);
app.use('/api/v1/levels', levelRoutes);
// Register routes
app.use('/api/v1/gifts', giftRoutes);


// Socket.io handler
socketHandler(io);

// Make io accessible to routes
app.set('io', io);

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5500;

// Only start listening locally
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.io server is ready`);
  });
}


// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

scheduleWeeklyRewards();

scheduleJob();



module.exports = server;