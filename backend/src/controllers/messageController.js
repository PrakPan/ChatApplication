const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

// Get all conversations for logged-in user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const conversations = await Conversation.find({
      participants: userId
    })
      .populate('participants', 'name avatar userId isActive')
      .populate({
        path: 'lastMessage',
        select: 'content messageType sender createdAt status'
      })
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Format response to match frontend expectations
    const formattedConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(
        p => p._id.toString() !== userId.toString()
      );

      return {
        userId: otherParticipant, // Changed from 'participant' to 'userId' to match frontend
        conversationId: conv.conversationId,
        lastMessage: conv.lastMessage ? {
          message: conv.lastMessage.content,
          createdAt: conv.lastMessage.createdAt
        } : null,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: conv.unreadCount.get(userId.toString()) || 0,
        isPinned: conv.isPinned.get(userId.toString()) || false,
        isMuted: conv.isMuted.get(userId.toString()) || false
      };
    });

    res.json({
      success: true,
      data: {
        conversations: formattedConversations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(conversations.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
};

// Get or create specific conversation
exports.getConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userId: otherUserId } = req.params;

    // Validate other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const conversationId = Message.generateConversationId(userId, otherUserId);
    
    let conversation = await Conversation.findOne({ conversationId })
      .populate('participants', 'name avatar userId isActive isOnline');

    // If conversation doesn't exist, create it
    if (!conversation) {
      conversation = await Conversation.findOrCreate(userId, otherUserId);
      await conversation.populate('participants', 'name avatar userId isActive isOnline');
    }

    const otherParticipant = conversation.participants.find(
      p => p._id.toString() !== userId.toString()
    );

    res.json({
      success: true,
      data: {
        conversation: {
          conversationId: conversation.conversationId,
          participant: otherParticipant,
          unreadCount: conversation.unreadCount.get(userId.toString()) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation'
    });
  }
};

// Get messages with pagination
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userId: otherUserId } = req.params;
    const { page = 1, limit = 50, before } = req.query;

    const conversationId = Message.generateConversationId(userId, otherUserId);

    const query = {
      conversationId,
      deletedFor: { $ne: userId }
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name avatar userId')
      .populate({
        path: 'replyTo',
        select: 'content messageType sender',
        populate: {
          path: 'sender',
          select: 'name avatar'
        }
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalMessages = await Message.countDocuments(query);

    // Format messages to match frontend expectations
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      senderId: msg.sender._id,
      sender: msg.sender,
      message: msg.content,
      content: msg.content,
      messageType: msg.messageType,
      mediaUrl: msg.mediaUrl,
      createdAt: msg.createdAt,
      status: msg.status,
      isRead: msg.status === 'read',
      replyTo: msg.replyTo
    }));

    res.json({
      success: true,
      data: {
        messages: formattedMessages.reverse(), // Return in chronological order
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalMessages / limit),
          totalMessages,
          hasMore: messages.length === parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

// Send text message
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { recipientId, content, replyTo, callId } = req.body;

    if (!recipientId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and content are required'
      });
    }

    // Validate recipient
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    const conversationId = Message.generateConversationId(userId, recipientId);

    const message = await Message.create({
      conversationId,
      sender: userId,
      recipient: recipientId,
      messageType: 'text',
      content,
      replyTo,
      callId,
      status: 'sent'
    });

    await message.populate('sender', 'name avatar userId');
    if (replyTo) {
      await message.populate('replyTo', 'content messageType sender');
    }

    // Update or create conversation
    let conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      conversation = await Conversation.findOrCreate(userId, recipientId);
    }
    
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();
    await conversation.incrementUnread(recipientId);

    // Format response
    const formattedMessage = {
      _id: message._id,
      senderId: message.sender._id,
      sender: message.sender,
      message: message.content,
      content: message.content,
      messageType: message.messageType,
      createdAt: message.createdAt,
      status: message.status
    };

    res.status(201).json({
      success: true,
      data: {
        message: formattedMessage
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userId: otherUserId } = req.params;

    const conversationId = Message.generateConversationId(userId, otherUserId);

    // Update all unread messages in this conversation
    await Message.updateMany(
      {
        conversationId,
        recipient: userId,
        status: { $ne: 'read' }
      },
      {
        status: 'read',
        readAt: new Date()
      }
    );

    // Reset unread count in conversation
    const conversation = await Conversation.findOne({ conversationId });
    if (conversation) {
      await conversation.resetUnread(userId);
    }

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
};

// Send media message
exports.sendMediaMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { recipientId, replyTo, callId } = req.body;

    if (!recipientId || !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Recipient and file are required'
      });
    }

    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'chat-media',
      resource_type: 'auto'
    });

    const messageType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
    const conversationId = Message.generateConversationId(userId, recipientId);

    const message = await Message.create({
      conversationId,
      sender: userId,
      recipient: recipientId,
      messageType,
      mediaUrl: result.secure_url,
      mediaMetadata: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        thumbnailUrl: messageType === 'image' ? result.secure_url : null
      },
      replyTo,
      callId,
      status: 'sent'
    });

    await message.populate('sender', 'name avatar userId');

    // Update conversation
    const conversation = await Conversation.findOrCreate(userId, recipientId);
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();
    await conversation.incrementUnread(recipientId);

    res.status(201).json({
      success: true,
      data: {
        message: message.toJSON()
      }
    });
  } catch (error) {
    console.error('Error sending media message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send media message'
    });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;
    const { deleteForEveryone = false } = req.body;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (deleteForEveryone) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (message.createdAt < oneHourAgo) {
        return res.status(400).json({
          success: false,
          message: 'Can only delete for everyone within 1 hour'
        });
      }

      message.isDeleted = true;
      message.content = 'This message was deleted';
      await message.save();
    } else {
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
      }
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
};

// Search messages
exports.searchMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { query, userId: otherUserId } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchQuery = {
      $or: [
        { sender: userId },
        { recipient: userId }
      ],
      messageType: 'text',
      content: { $regex: query, $options: 'i' },
      deletedFor: { $ne: userId }
    };

    if (otherUserId) {
      const conversationId = Message.generateConversationId(userId, otherUserId);
      searchQuery.conversationId = conversationId;
    }

    const messages = await Message.find(searchQuery)
      .populate('sender', 'name avatar userId')
      .populate('recipient', 'name avatar userId')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length
      }
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search messages'
    });
  }
};

// Get total unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId
    });

    let totalUnread = 0;
    conversations.forEach(conv => {
      totalUnread += conv.unreadCount.get(userId.toString()) || 0;
    });

    res.json({
      success: true,
      data: {
        unreadCount: totalUnread
      }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
};