const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload'); // Multer middleware for file uploads

// All routes require authentication
router.use(protect);

// Get all conversations
router.get('/conversations', messageController.getConversations);

// Get or create specific conversation
router.get('/conversation/:userId', messageController.getConversation);

// Get messages for a conversation
router.get('conversation/:userId', messageController.getMessages);

// Send text message
router.post('/send', messageController.sendMessage);

// Send media message
router.post('/send-media', upload.single('file'), messageController.sendMediaMessage);

// Mark messages as read
router.put('/read/:userId', messageController.markAsRead);

// Delete message
router.delete('/:messageId', messageController.deleteMessage);

// Search messages
router.get('/search', messageController.searchMessages);

// Get unread count
router.get('/unread-count', messageController.getUnreadCount);

module.exports = router;