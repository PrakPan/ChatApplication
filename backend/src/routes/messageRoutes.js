const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload'); 


router.use(protect);


router.get('/conversations', messageController.getConversations);


router.get('/conversations/:userId', messageController.getConversation);


router.get('/conversations/:userId/messages', messageController.getMessages);


router.post('/send', messageController.sendMessage);

router.post('/send/media', upload.single('file'), messageController.sendMediaMessage);

// Delete message
router.delete('/messages/:messageId', messageController.deleteMessage);

// Search messages
router.get('/search', messageController.searchMessages);

// Get unread count
router.get('/unread-count', messageController.getUnreadCount);

module.exports = router;