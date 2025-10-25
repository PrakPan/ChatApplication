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

// Import routes
const authRoutes = require('./routes/authRoutes');
const hostRoutes = require('./routes/hostRoutes');
const coinRoutes = require('./routes/coinRoutes');
const callRoutes = require('./routes/callRoutes');
const adminRoutes = require('./routes/adminRoutes');

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
  origin: process.env.CLIENT_URL || 'https://chat-application-khaki-two.vercel.app',
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
app.use('/api/v1/hosts', hostRoutes);
app.use('/api/v1/coins', coinRoutes);
app.use('/api/v1/calls', callRoutes);
app.use('/api/v1/admin', adminRoutes);

// Socket.io handler
socketHandler(io);

// Make io accessible to routes
app.set('io', io);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5500;

server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.io server is ready`);
});

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

// const names = [
//   'Priya Sharma', 'Rahul Kumar', 'Anjali Patel', 'Arjun Singh', 'Sneha Gupta',
//   'Vikram Reddy', 'Pooja Mehta', 'Rohan Joshi', 'Neha Kapoor', 'Aditya Verma',
//   'Kavya Iyer', 'Sanjay Desai', 'Riya Malhotra', 'Karan Nair', 'Divya Saxena',
//   'Amit Shah', 'Sakshi Rao', 'Nikhil Agarwal', 'Ananya Bose', 'Varun Chopra'
// ];

// const bios = [
//   'Love to chat and meet new people! Available for friendly conversations.',
//   'Professional listener and conversation partner. Here to make your day better!',
//   'Passionate about movies, music, and deep conversations.',
//   'Your friendly companion for late-night chats and good vibes.',
//   'Experienced in providing emotional support and meaningful discussions.',
//   'Fun, friendly, and always ready to listen!',
//   'Let\'s talk about anything under the sun!',
//   'Here to spread positivity and good energy.',
//   'Great listener, better friend. Let\'s connect!',
//   'Available 24/7 for genuine conversations.'
// ];

// const languages = ['Hindi', 'English', 'Punjabi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati'];
// const interests = ['Movies', 'Music', 'Sports', 'Travel', 'Food', 'Technology', 'Fashion', 'Fitness', 'Reading', 'Gaming'];

// const callStatuses = ['completed', 'cancelled', 'failed'];
// const cancelReasons = [
//   'Poor connection',
//   'Changed my mind',
//   'Emergency',
//   'Technical issues',
//   'No response'
// ];

// // Helper functions
// const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
// const getRandomElements = (arr, count) => {
//   const shuffled = [...arr].sort(() => 0.5 - Math.random());
//   return shuffled.slice(0, count);
// };
// const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
// const getRandomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

// // Generate phone number
// const generatePhone = () => {
//   const prefixes = ['98', '99', '97', '96', '95', '94', '93', '92', '91', '90'];
//   return getRandomElement(prefixes) + Math.floor(10000000 + Math.random() * 90000000);
// };

// // Clear existing data
// async function clearDatabase() {
//   console.log('Clearing existing data...');
//   await User.deleteMany({});
//   await Host.deleteMany({});
//   await Call.deleteMany({});
//   await Transaction.deleteMany({});
//   await Withdrawal.deleteMany({});
//   console.log('Database cleared!');
// }

// // Create users
// async function createUsers(count = 20) {
//   console.log(`Creating ${count} users...`);
//   const users = [];
  
//   for (let i = 0; i < count; i++) {
//     const name = names[i] || `User ${i + 1}`;
//     const user = await User.create({
//       name,
//       email: `user${i + 1}@example.com`,
//       phone: generatePhone(),
//       password: 'Password123!',
//       role: 'user',
//       coinBalance: getRandomNumber(0, 5000),
//       isActive: Math.random() > 0.1,
//       isVerified: Math.random() > 0.2,
//       lastLogin: getRandomDate(new Date(2024, 0, 1), new Date())
//     });
//     users.push(user);
//   }
  
//   console.log(`✓ Created ${users.length} users`);
//   return users;
// }

// // Create hosts
// async function createHosts(users, count = 10) {
//   console.log(`Creating ${count} hosts...`);
//   const hosts = [];
  
//   for (let i = 0; i < count; i++) {
//     const name = names[i + 10] || `Host ${i + 1}`;
    
//     // Create host user
//     const hostUser = await User.create({
//       name,
//       email: `host${i + 1}@example.com`,
//       phone: generatePhone(),
//       password: 'Password123!',
//       role: 'host',
//       coinBalance: 0,
//       isActive: true,
//       isVerified: true,
//       lastLogin: getRandomDate(new Date(2024, 0, 1), new Date())
//     });
    
//     // Create host profile
//     const host = await Host.create({
//       userId: hostUser._id,
//       bio: getRandomElement(bios),
//       ratePerMinute: getRandomNumber(20, 100),
//       isOnline: Math.random() > 0.5,
//       isKycVerified: Math.random() > 0.3,
//       kycDocuments: {
//         idType: 'Aadhaar',
//         idNumber: `${getRandomNumber(1000, 9999)} ${getRandomNumber(1000, 9999)} ${getRandomNumber(1000, 9999)}`,
//         idFrontImage: `https://example.com/kyc/front_${i + 1}.jpg`,
//         idBackImage: `https://example.com/kyc/back_${i + 1}.jpg`,
//         selfieImage: `https://example.com/kyc/selfie_${i + 1}.jpg`
//       },
//       totalEarnings: getRandomNumber(0, 50000),
//       totalCalls: getRandomNumber(0, 500),
//       rating: (Math.random() * 2 + 3).toFixed(1), // Between 3.0 and 5.0
//       totalRatings: getRandomNumber(0, 200),
//       photos: [
//         `https://example.com/photos/${i + 1}_1.jpg`,
//         `https://example.com/photos/${i + 1}_2.jpg`,
//         `https://example.com/photos/${i + 1}_3.jpg`
//       ],
//       status: getRandomElement(['pending', 'approved', 'rejected', 'suspended']),
//       bankDetails: {
//         accountName: name,
//         accountNumber: `${getRandomNumber(10000000, 99999999)}${getRandomNumber(10000000, 99999999)}`,
//         ifscCode: `SBIN000${getRandomNumber(1000, 9999)}`,
//         bankName: 'State Bank of India',
//         upiId: `${hostUser.phone}@paytm`
//       },
//       languages: getRandomElements(languages, getRandomNumber(2, 4)),
//       interests: getRandomElements(interests, getRandomNumber(3, 6))
//     });
    
//     hosts.push({ host, user: hostUser });
//   }
  
//   console.log(`✓ Created ${hosts.length} hosts`);
//   return hosts;
// }

// // Create calls
// async function createCalls(users, hosts, count = 50) {
//   console.log(`Creating ${count} calls...`);
//   const calls = [];
  
//   for (let i = 0; i < count; i++) {
//     const user = getRandomElement(users);
//     const hostData = getRandomElement(hosts);
//     const status = getRandomElement(callStatuses);
    
//     const startTime = getRandomDate(new Date(2024, 0, 1), new Date());
//     const durationMinutes = getRandomNumber(1, 60);
//     const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    
//     const call = await Call.create({
//       userId: user._id,
//       hostId: hostData.host._id,
//       startTime,
//       endTime: status === 'completed' ? endTime : (status === 'cancelled' ? new Date(startTime.getTime() + getRandomNumber(10000, 120000)) : undefined),
//       duration: status === 'completed' ? durationMinutes * 60 : (status === 'cancelled' ? getRandomNumber(10, 120) : 0),
//       coinsSpent: status === 'completed' ? durationMinutes * hostData.host.ratePerMinute : 0,
//       status,
//       rating: status === 'completed' && Math.random() > 0.3 ? getRandomNumber(3, 5) : undefined,
//       feedback: status === 'completed' && Math.random() > 0.5 ? 'Great conversation! Would call again.' : undefined,
//       cancelledBy: status === 'cancelled' ? getRandomElement(['user', 'host', 'system']) : undefined,
//       cancelReason: status === 'cancelled' ? getRandomElement(cancelReasons) : undefined
//     });
    
//     calls.push(call);
//   }
  
//   console.log(`✓ Created ${calls.length} calls`);
//   return calls;
// }

// // Create transactions
// async function createTransactions(users, calls, count = 100) {
//   console.log(`Creating ${count} transactions...`);
//   const transactions = [];
  
//   // Purchase transactions
//   for (let i = 0; i < count * 0.4; i++) {
//     const user = getRandomElement(users);
//     const coinAmount = getRandomElement([100, 500, 1000, 2000, 5000]);
//     const amount = coinAmount * 0.1; // 10 coins = 1 rupee
    
//     const transaction = await Transaction.create({
//       userId: user._id,
//       type: 'purchase',
//       amount,
//       coins: coinAmount,
//       status: getRandomElement(['completed', 'failed']),
//       paymentId: `pay_${Math.random().toString(36).substr(2, 9)}`,
//       orderId: `order_${Math.random().toString(36).substr(2, 9)}`,
//       paymentMethod: getRandomElement(['UPI', 'Card', 'NetBanking', 'Wallet']),
//       description: `Purchased ${coinAmount} coins`
//     });
    
//     transactions.push(transaction);
//   }
  
//   // Call debit transactions
//   for (let i = 0; i < calls.length; i++) {
//     const call = calls[i];
//     if (call.status === 'completed' && call.coinsSpent > 0) {
//       const transaction = await Transaction.create({
//         userId: call.userId,
//         type: 'call_debit',
//         amount: call.coinsSpent * 0.1,
//         coins: call.coinsSpent,
//         status: 'completed',
//         callId: call._id,
//         description: `Call charges deducted`
//       });
      
//       transactions.push(transaction);
//     }
//   }
  
//   // Refund transactions
//   for (let i = 0; i < count * 0.05; i++) {
//     const user = getRandomElement(users);
//     const coins = getRandomElement([50, 100, 200, 500]);
    
//     const transaction = await Transaction.create({
//       userId: user._id,
//       type: 'refund',
//       amount: coins * 0.1,
//       coins,
//       status: 'completed',
//       description: 'Call cancelled - coins refunded'
//     });
    
//     transactions.push(transaction);
//   }
  
//   console.log(`✓ Created ${transactions.length} transactions`);
//   return transactions;
// }

// // Create withdrawals
// async function createWithdrawals(hosts, count = 20) {
//   console.log(`Creating ${count} withdrawals...`);
//   const withdrawals = [];
  
//   for (let i = 0; i < count; i++) {
//     const hostData = getRandomElement(hosts);
//     const coins = getRandomNumber(1000, 10000);
//     const amount = coins * 0.1;
//     const status = getRandomElement(['pending', 'processing', 'completed', 'failed', 'rejected']);
    
//     const withdrawal = await Withdrawal.create({
//       hostId: hostData.host._id,
//       amount,
//       coins,
//       status,
//       bankDetails: hostData.host.bankDetails,
//       transactionId: status === 'completed' ? `TXN${Math.random().toString(36).substr(2, 12).toUpperCase()}` : undefined,
//       processedAt: ['completed', 'failed', 'rejected'].includes(status) ? getRandomDate(new Date(2024, 0, 1), new Date()) : undefined,
//       notes: status === 'completed' ? 'Withdrawal processed successfully' : undefined,
//       rejectionReason: status === 'rejected' ? 'Invalid bank details' : undefined
//     });
    
//     withdrawals.push(withdrawal);
//   }
  
//   console.log(`✓ Created ${withdrawals.length} withdrawals`);
//   return withdrawals;
// }
// const MONGODB_URI = process.env.MONGODB_URI
// // Main seed function
// async function seedDatabase() {
//   try {
//     console.log('🌱 Starting database seeding...\n');
    
//     // Connect to MongoDB
//     await mongoose.connect(MONGODB_URI);
//     console.log('✓ Connected to MongoDB\n');
    
//     // Clear existing data
//     await clearDatabase();
//     console.log('');
    
//     // Create data
//     const users = await createUsers(20);
//     const hosts = await createHosts(users, 10);
//     const calls = await createCalls(users, hosts, 50);
//     const transactions = await createTransactions(users, calls, 100);
//     const withdrawals = await createWithdrawals(hosts, 20);
    
//     console.log('\n✅ Database seeding completed successfully!\n');
//     console.log('Summary:');
//     console.log(`  Users: ${users.length}`);
//     console.log(`  Hosts: ${hosts.length}`);
//     console.log(`  Calls: ${calls.length}`);
//     console.log(`  Transactions: ${transactions.length}`);
//     console.log(`  Withdrawals: ${withdrawals.length}`);
    
//     console.log('\n📝 Sample Credentials:');
//     console.log('  User Email: user1@example.com');
//     console.log('  Host Email: host1@example.com');
//     console.log('  Password: Password123!');
    
//   } catch (error) {
//     console.error('❌ Error seeding database:', error);
//   } finally {
//     await mongoose.connection.close();
//     console.log('\n✓ Database connection closed');
//     process.exit(0);
//   }
// }

// // Run the seed function
// seedDatabase();

module.exports = { app, server, io };